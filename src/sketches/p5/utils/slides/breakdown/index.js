// Breakdown orchestrator: turns a "breakdown" content item into per-frame
// interpolated sketch parameters (the sketch visibly stabilizes group by
// group) and into the narration state the overlay renders. Injected in
// slides.getSketchSettings — the same seam the montage uses — so the running
// sketch and every overlay reading options.sketch see the in-progress values
// with zero per-sketch code.
//
// PERFORMANCE CONTRACT: getSketchSettings fires on EVERY options.sketch
// property access (dozens+ per frame), so everything here is memoized:
//   - derived cache: steps + start values + schedule, keyed on the STORE
//     object identities (global sketch / slide sketch / item.build) plus the
//     form-meta bridge's formValues/formConfiguration refs (the diff
//     selection depends on them). The option store and the React provider
//     replace objects on edit, so ref-equality is a correct invalidation
//     key. NOTE: the caller's merged { ...global, ...slide } object is
//     rebuilt per access — never key on it.
//   - frame cache: the interpolated values, keyed on (derived, progression).
//     Deterministic capture pins the frame → same progression → cache hit;
//     live playback recomputes once per frame.

import lerpParams from "../morph/lerpParams.js";
import staggeredProgress from "../morph/staggeredProgress.js";
import easing from "../../easing.js";
import animation from "../../animation.js";
import {
  getSketchOptions
} from "../../../shared/syncSketchOptions.js";
import deriveBreakdownSteps, {
  getByPath
} from "./deriveSteps.js";
import buildStartValues from "./startValues.js";
import getFormMeta from "./formMeta.js";
import {
  buildBreakdownSchedule,
  resolveBreakdownProgress
} from "./schedule.js";

function isPlainObject( value ) {
  return value != null && typeof value === "object" && !Array.isArray( value );
}

/**
 * Find the breakdown item governing the current frame, reading RAW store
 * arrays only (never the options proxy — its get trap would recurse back
 * into getSketchSettings). Slide content wins over global content; the first
 * breakdown item per list wins.
 */
export function findActiveBreakdownItem(
  optionsTarget, slideIndex, slideCount
) {
  const pick = ( list ) =>
    ( Array.isArray( list )
      ? list.find( ( item ) => item?.type === "breakdown" )
      : undefined );

  if ( slideCount > 0 && slideIndex != null ) {
    const n = slideCount;
    const idx = ( ( ( Math.trunc( Number( slideIndex ) || 0 ) ) % n ) + n ) % n;
    const slideItem = pick( optionsTarget?.slides?.[ idx ]?.content );

    if ( slideItem ) {
      return slideItem;
    }
  }

  return pick( optionsTarget?.content );
}

/* ---- derived cache (steps / start values / schedule) -------------- */

let derivedCache = null;

function getDerived(
  globalSketch, slideSketch, item
) {
  // Key on the item's `build` object, not the item itself: only `build`
  // affects derivation, and the drag layer wraps the item in a fresh
  // { ...item, position } object every frame mid-drag — keying on the item
  // would make the overlay (dragged wrapper) and the injection (raw store
  // item) thrash this single-slot cache against each other.
  const buildRef = item?.build ?? item;
  const formMeta = getFormMeta();

  if (
    derivedCache &&
    derivedCache.globalRef === globalSketch &&
    derivedCache.slideRef === slideSketch &&
    derivedCache.buildRef === buildRef &&
    derivedCache.formValuesRef === formMeta.formValues &&
    derivedCache.formConfigRef === formMeta.formConfiguration
  ) {
    return derivedCache;
  }

  const finalSketch = {
    ...( globalSketch || {} ),
    ...( slideSketch || {} )
  };
  const build = item?.build ?? {};
  const steps = deriveBreakdownSteps(
    finalSketch,
    build,
    formMeta
  );
  const animSteps = steps.filter( ( step ) => !step.overflow );
  const startValues = buildStartValues(
    finalSketch,
    build,
    formMeta
  );

  // Flat start slice per animated step (mirrors each step's finalSlice), so
  // the per-frame work is a handful of leaf lerps — no deep walks.
  const startSlices = animSteps.map( ( step ) => {
    const slice = {};

    for ( const path of step.paths ) {
      slice[ path ] = getByPath(
        startValues,
        path
      );
    }

    return slice;
  } );

  // Every ancestor prefix of an animated path: the reifier rebuilds only
  // these subtrees and reuses the final object's references elsewhere.
  const animatedPrefixes = new Set();

  for ( const step of animSteps ) {
    for ( const path of step.paths ) {
      const segments = path.split( "." );

      let prefix = "";

      for ( let i = 0; i < segments.length - 1; i++ ) {
        prefix = prefix ? `${ prefix }.${ segments[ i ] }` : segments[ i ];
        animatedPrefixes.add( prefix );
      }
    }
  }

  derivedCache = {
    globalRef: globalSketch,
    slideRef: slideSketch,
    buildRef,
    formValuesRef: formMeta.formValues,
    formConfigRef: formMeta.formConfiguration,
    finalSketch,
    build,
    steps,
    animSteps,
    startValues,
    startSlices,
    animatedPrefixes,
    schedule: buildBreakdownSchedule(
      animSteps.length,
      build
    ),
    easingFn: easing[ build.easing ] ?? easing.linear
  };

  return derivedCache;
}

/* ---- frame cache (per-progression interpolation) ------------------ */

let frameCache = null;

function getFrame(
  derived, progression
) {
  if (
    frameCache &&
    frameCache.derived === derived &&
    frameCache.progression === progression
  ) {
    return frameCache;
  }

  const progress = resolveBreakdownProgress(
    derived.schedule,
    progression,
    derived.easingFn
  );

  // Flat path → in-progress value for every animated leaf, plus the eased
  // per-leaf progress the overlay renders (bars, crossfades). With
  // build.lineStagger > 0 the leaves of one step animate offset from each
  // other (staggeredProgress within the step's raw window) — one line after
  // another at 1. Fully locked leaves contribute no currentFlat entry (they
  // read final via the reify reuse).
  const currentFlat = new Map();
  const leafT = new Map();
  const spread = derived.build.lineStagger ?? 0;
  const snapKeys = derived.build.snapKeys ?? [];

  let allLocked = true;

  derived.animSteps.forEach( (
    step, index
  ) => {
    const raw = progress.rawStepT[ index ];
    const denom = step.paths.length - 1;

    step.paths.forEach( (
      path, leafIndex
    ) => {
      const leafRaw = staggeredProgress(
        raw,
        denom > 0 ? leafIndex / denom : 0,
        spread
      );
      const eased =
        leafRaw <= 0 ? 0 : leafRaw >= 1 ? 1 : derived.easingFn( leafRaw );

      leafT.set(
        path,
        eased
      );

      if ( leafRaw >= 1 ) {
        return;
      }

      allLocked = false;

      const slice = lerpParams(
        {
          [ path ]: derived.startSlices[ index ][ path ]
        },
        {
          [ path ]: step.finalSlice[ path ]
        },
        eased,
        snapKeys
      );

      currentFlat.set(
        path,
        slice[ path ]
      );
    } );
  } );

  frameCache = {
    derived,
    progression,
    progress,
    currentFlat,
    leafT,
    allLocked,
    nested: null
  };

  return frameCache;
}

// Rebuild the sketch object with in-progress leaves substituted, reusing the
// final object's references for every untouched subtree.
function reify(
  node, prefix, currentFlat, animatedPrefixes
) {
  if ( !isPlainObject( node ) ) {
    return node;
  }

  if ( prefix && !animatedPrefixes.has( prefix ) ) {
    return node;
  }

  const out = {};

  for ( const key of Object.keys( node ) ) {
    const path = prefix ? `${ prefix }.${ key }` : key;

    if ( currentFlat.has( path ) ) {
      out[ key ] = currentFlat.get( path );
      continue;
    }

    const value = node[ key ];

    out[ key ] = isPlainObject( value )
      ? reify(
        value,
        path,
        currentFlat,
        animatedPrefixes
      )
      : value;
  }

  return out;
}

/**
 * The injection entry: the sketch parameters the running sketch should see
 * at `progression`, or null when the breakdown is a no-op (missing item,
 * nothing changed / nothing animatable) — the caller then falls back to the
 * normal effective settings.
 */
export default function getBreakdownSketch(
  globalSketch, slideSketch, item, progression
) {
  if ( !item ) {
    return null;
  }

  const derived = getDerived(
    globalSketch,
    slideSketch,
    item
  );

  if ( !derived.animSteps.length ) {
    return null;
  }

  const frame = getFrame(
    derived,
    progression
  );

  // Everything settled (outro, or all windows locked) → the final object.
  if ( frame.allLocked ) {
    return derived.finalSketch;
  }

  if ( !frame.nested ) {
    frame.nested = reify(
      derived.finalSketch,
      "",
      frame.currentFlat,
      derived.animatedPrefixes
    );
  }

  return frame.nested;
}

/**
 * The overlay entry: narration state for the same frame, served from the
 * same caches so the overlay can never drift from what the sketch renders.
 */
export function getBreakdownState(
  globalSketch, slideSketch, item, progression
) {
  const derived = getDerived(
    globalSketch,
    slideSketch,
    item
  );
  const frame = getFrame(
    derived,
    progression
  );

  return {
    steps: derived.steps,
    animSteps: derived.animSteps,
    schedule: derived.schedule,
    startValues: derived.startValues,
    finalSketch: derived.finalSketch,
    progress: frame.progress,
    currentFlat: frame.currentFlat,
    leafT: frame.leafT
  };
}

/**
 * Convenience for the overlay renderer: resolve the narration state against
 * the RAW option store (options.sketch reads back the interpolated values —
 * the final values must come from the store), mirroring exactly what the
 * injection in slides.getSketchSettings resolves, so both hit the same
 * caches for the same frame. The slide index comes from the slides module's
 * window bridge to avoid a circular import (slides/index.js imports us).
 */
export function getBreakdownRuntimeState( item ) {
  const store = getSketchOptions() ?? {};
  const slideCount = Array.isArray( store.slides ) ? store.slides.length : 0;
  const slideIndex =
    typeof window !== "undefined" ? window.slides?.index : null;

  let slideSketch;

  if ( slideCount > 0 && slideIndex != null ) {
    const n = slideCount;
    const idx = ( ( Math.trunc( Number( slideIndex ) || 0 ) % n ) + n ) % n;

    slideSketch = store.slides[ idx ]?.sketch;
  }

  return getBreakdownState(
    store.sketch || {},
    slideSketch,
    item,
    animation.progression
  );
}

// Test hook: caches are module state; tests reset them between cases.
export function __resetBreakdownCaches() {
  derivedCache = null;
  frameCache = null;
}
