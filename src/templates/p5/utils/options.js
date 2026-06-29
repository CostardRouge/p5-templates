/* ------------------------------------------------------------------ */
/*  Imports                                                           */
/* ------------------------------------------------------------------ */

import events from "./events.js";
import exif from "./exif.js";
import cache from "./cache.js";
import sketch from "./sketch.js";
import {
  getP5, getContainer
} from "./sketch.js";

import {
  getSketchOptions, setSketchOptions, subscribeSketchOptions
} from "../shared/syncSketchOptions.js";

import {
  resolveAssetURL
} from "../shared/utils.js";

import {
  coerceFramerate
} from "./framerate.js";

import {
  mergeSlideOverride
} from "@/lib/effectiveSlideSettings";

import animation from "./animation.js";

import {
  resolveBindings, computeBindingSignals
} from "./interaction/bindings.js";
import {
  sampleChannels
} from "./interaction/channels.js";
import {
  publishChannels, publishBindingSignals
} from "@/lib/channelBridge";

import {
  interactionBindingsEnabled
} from "@/lib/interactionBindings";

// The interaction-bindings plugin gate. Read once — it's a build-time flag, so
// when off the per-frame channel sampling/publishing and binding resolution are
// skipped entirely and a normal sketch pays nothing for the feature.
const BINDINGS_ENABLED = interactionBindingsEnabled();

/* ------------------------------------------------------------------ */
/*  Debounced, de-duplicated asset refresher                          */
/* ------------------------------------------------------------------ */

let refreshTimer = -1;

function refreshAssets() {
  if ( refreshTimer === -1 ) {
    _refreshAssets();
  }

  clearTimeout( refreshTimer );
  refreshTimer = setTimeout(
    _refreshAssets,
    80
  );
}

const IMAGE_PATH_RE = /\.(png|jpe?g|webp|gif|svg|avif|bmp|arw)(\?|#|$)/i;

function isImagePath( value ) {
  if ( typeof value !== "string" || !value ) {
    return false;
  }
  if ( value.startsWith( "blob:" ) ) {
    return true;
  }
  return IMAGE_PATH_RE.test( value );
}

function collectImagePathsDeep(
  node, acc
) {
  if ( !node ) {
    return;
  }
  if ( typeof node === "string" ) {
    if ( isImagePath( node ) ) {
      acc.push( node );
    }
    return;
  }
  if ( Array.isArray( node ) ) {
    for ( const v of node ) {
      collectImagePathsDeep(
        v,
        acc
      );
    }
    return;
  }
  if ( typeof node === "object" ) {
    for ( const k of Object.keys( node ) ) {
      collectImagePathsDeep(
        node[ k ],
        acc
      );
    }
  }
}

async function _refreshAssets() {
  const opts = getSketchOptions();
  const globalImages = opts.assets?.images ?? [];
  // Also pick up images stored directly in sketch form fields (e.g. images-stack
  // arrays at sketch.images, and single `image` component values nested anywhere
  // under sketch.* such as sketch.photo or sketch.photo.image).
  const sketchImages = [];

  collectImagePathsDeep(
    opts.sketch,
    sketchImages
  );
  const slideImages = ( opts.slides ?? [] ).flatMap( ( slide ) => {
    const fromSlide = [
      ...( slide?.assets?.images ?? [] )
    ];

    collectImagePathsDeep(
      slide?.sketch,
      fromSlide
    );
    return fromSlide;
  } );

  const allPaths = [
    ...new Set( [
      ...globalImages,
      ...sketchImages,
      ...slideImages
    ] )
  ];

  if ( allPaths.length === 0 ) {
    cache.set(
      "imagesMap",
      new Map()
    );
    cache.set(
      "images",
      []
    );
    const container = getContainer();
    const canvas = container?.querySelector( "canvas" ) ?? document.querySelector( "canvas.p5Canvas" );

    canvas?.classList.add( "loaded" );
    return;
  }

  const prevMap = cache.get( "imagesMap" ) ?? new Map();
  const newMap = new Map();

  for ( const path of allPaths ) {
    let obj = prevMap.get( path );

    if ( !obj ) {
      const url = resolveAssetURL(
        path,
        opts.id
      );

      obj = {
        path,
        filename: path.split( "/" ).pop(),
        img: getP5().loadImage( url ),
        exif: undefined
      };

      readExifInfo(
        obj,
        url
      );
    }

    newMap.set(
      path,
      obj
    );
    prevMap.delete( path );
  }

  prevMap.forEach( ( o ) => {
    o.img?.remove?.();
    delete o.exif;
  } );

  cache.set(
    "imagesMap",
    newMap
  );
  cache.set(
    "images",
    [
      ...newMap.values()
    ]
  );
}

async function readExifInfo(
  object, url
) {
  try {
    let tags;

    try {
      tags = url.startsWith( "blob:" )
        ? await exif.load( await ( await fetch( url ) ).arrayBuffer() )
        : await exif.load( url );
    } catch( error ) {
      console.error(
        "readExifInfo error",
        error
      );
      tags = null;
    }

    object.exif = tags;
  } catch( e ) {
    console.warn(
      "[EXIF] fail",
      object.path,
      e
    );
    object.exif = null;
  }
}

/* ------------------------------------------------------------------ */
/*  Canvas "loaded" indicator once EXIF results return               */
/* ------------------------------------------------------------------ */

function markLoadedWhenExifReady() {
  const container = getContainer();
  const c = container?.querySelector( "canvas" ) ?? document.querySelector( "canvas.p5Canvas" );

  if ( !c || c.classList.contains( "loaded" ) ) {
    return;
  }
  if ( cache.get( "images" )?.every( ( img ) => img.exif === undefined ) ) {
    return;
  }
  c.classList.add( "loaded" );
}

/* ------------------------------------------------------------------ */
/*  Event hooks                                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Options change tracking                                           */
/* ------------------------------------------------------------------ */

let previousOptions = {
  size: null,
  animation: null,
  effectiveSize: null,
  effectiveAnimation: null
};

let unsubscribe = null;

/**
 * Compare two objects for deep equality
 */
function isEqual(
  a, b
) {
  if ( a === b ) {
    return true;
  }
  if ( !a || !b ) {
    return false;
  }
  if ( typeof a !== "object" || typeof b !== "object" ) {
    return false;
  }

  return JSON.stringify( a ) === JSON.stringify( b );
}

/**
 * Resolve the effective size/animation for the current slide.
 * Per-slide overrides win; otherwise global values are used.
 *
 * Uses the resolved `slide` object (not the raw index): rendering coerces
 * a null/out-of-range index to slide 0, so the effective settings must
 * follow the slide that is actually drawn — otherwise a transiently null
 * index would silently mask every per-slide override.
 */
function getEffective( opts ) {
  const current = typeof window !== "undefined" && window.getCurrentSlide
    ? window.getCurrentSlide()
    : null;
  const slide = current?.slide ?? null;

  return {
    size: mergeSlideOverride(
      opts?.size,
      slide?.size
    ),
    animation: mergeSlideOverride(
      opts?.animation,
      slide?.animation
    )
  };
}

/**
 * Handle options changes and trigger appropriate events
 */
function handleOptionsChange(
  newOptions, origin
) {
  // Skip if this update came from the p5 engine itself to avoid loops
  if ( origin === "p5" ) {
    return;
  }

  let hasChanges = false;

  const {
    size: effectiveSize,
    animation: effectiveAnimation
  } = getEffective( newOptions );

  // Check for effective size changes (slide override or global)
  if ( effectiveSize && !isEqual(
    effectiveSize,
    previousOptions.effectiveSize
  ) ) {
    const {
      width,
      height
    } = effectiveSize;

    if ( width && height ) {
      events.handle(
        "engine-resize-canvas",
        width,
        height
      );

      // Update sketch options reference
      if ( sketch.sketchOptions ) {
        sketch.sketchOptions.size = {
          ...effectiveSize
        };
      }

      previousOptions.effectiveSize = {
        ...effectiveSize
      };
      hasChanges = true;
    }
  }

  // Check for effective animation changes (slide override or global).
  // Duration and framerate are decoupled: the engine clock must pick up a
  // duration change even when the framerate is untouched (or missing from
  // a partial per-slide override), so the sketchOptions update is never
  // gated behind framerate validity.
  if ( effectiveAnimation && !isEqual(
    effectiveAnimation,
    previousOptions.effectiveAnimation
  ) ) {
    // Coerce both sides: a framerate may arrive as a numeric string
    // (imported options, persisted job) and must still apply — p5 would
    // silently ignore it otherwise.
    const framerate = coerceFramerate( effectiveAnimation?.framerate );
    const previousFramerate = coerceFramerate( previousOptions.effectiveAnimation?.framerate );

    if ( framerate !== null && framerate !== previousFramerate ) {
      events.handle(
        "engine-framerate-change",
        framerate
      );
    }

    // Update sketch options reference — merge so a partial override
    // (e.g. duration-only) doesn't drop the other animation keys.
    if ( sketch.sketchOptions ) {
      sketch.sketchOptions.animation = {
        ...sketch.sketchOptions.animation,
        ...effectiveAnimation
      };
    }

    previousOptions.effectiveAnimation = {
      ...effectiveAnimation
    };
    hasChanges = true;
  }

  // Also track raw globals for reference
  previousOptions.size = newOptions?.size ? {
    ...newOptions.size
  } : null;
  previousOptions.animation = newOptions?.animation ? {
    ...newOptions.animation
  } : null;

  // Refresh assets if there were any changes or if assets changed
  if ( hasChanges || !isEqual(
    newOptions?.assets,
    previousOptions.assets
  ) || !isEqual(
    newOptions?.slides,
    previousOptions.slides
  ) ) {
    refreshAssets();
    previousOptions.assets = newOptions?.assets;
    previousOptions.slides = newOptions?.slides;
  }
}

/**
 * Initialize options subscription
 */
function initializeOptionsSubscription() {
  // Clean up existing subscription if any
  if ( unsubscribe ) {
    unsubscribe();
    unsubscribe = null;
  }

  // Get initial options and store them
  const initialOptions = getSketchOptions();

  // Baseline on the *effective* values (per-slide overrides included) so
  // a deck loaded with a slide whose animation differs from the globals
  // starts from the right comparison point — and the engine clock starts
  // on the slide's duration, not the global one.
  const {
    size: initialEffectiveSize,
    animation: initialEffectiveAnimation
  } = getEffective( initialOptions );

  if ( initialEffectiveAnimation && sketch.sketchOptions ) {
    sketch.sketchOptions.animation = {
      ...sketch.sketchOptions.animation,
      ...initialEffectiveAnimation
    };
  }

  previousOptions = {
    size: initialOptions?.size ? {
      ...initialOptions.size
    } : null,
    animation: initialOptions?.animation ? {
      ...initialOptions.animation
    } : null,
    effectiveSize: initialEffectiveSize ? {
      ...initialEffectiveSize
    } : null,
    effectiveAnimation: initialEffectiveAnimation ? {
      ...initialEffectiveAnimation
    } : null,
    assets: initialOptions?.assets,
    slides: initialOptions?.slides
  };

  // Subscribe to future changes
  unsubscribe = subscribeSketchOptions( handleOptionsChange );

  // Sync initial options to sketch
  setSketchOptions(
    initialOptions,
    sketch.sketchOptions?.engine ?? "p5"
  );
}

// Called by sketch.start() on every sketch initialization so that these
// handlers survive a reset() which clears events.registeredEvents.
export function registerEvents() {
  events.register(
    "engine-window-preload",
    refreshAssets
  );
  events.register(
    "pre-draw",
    markLoadedWhenExifReady
  );
  events.register(
    "pre-draw",
    publishChannelsFrame
  );
  events.register(
    "pre-setup",
    initializeOptionsSubscription
  );
  events.register(
    "pre-setup",
    initInteractionForOptions
  );
}

// Tracks whether the interaction handler was booted for the current sketch, so
// dispose-on-reset only loads the (lazy) module when there's something to free.
let _interactionInited = false;

// Engine-managed interaction init: when a sketch's options carry an enabled
// `interaction` block, boot the handler once at setup so its sources (webcam,
// audio, gyro, touch, …) are available as binding channels with no per-sketch
// code. The handler is imported LAZILY (never statically) to keep MediaPipe out
// of the core module-eval chain. `initInteraction` is idempotent (re-arms
// listeners), so it's safe alongside sketches that still call it themselves;
// fire-and-forget so vision warm-up doesn't block setup.
function initInteractionForOptions() {
  try {
    const interaction = liveSketchBase( getSketchOptions() )?.interaction;

    if ( interaction && interaction.enabled !== false ) {
      _interactionInited = true;
      import( "./interaction/index.js" )
        .then( ( mod ) => mod.initInteraction( interaction ) )
        .catch( () => {} );
    }
  } catch {
    // Never let interaction init break setup.
  }
}

// Release the camera/mic/listeners held by the interaction handler. Called from
// sketch.reset() so resources are freed before the next sketch loads (also
// fixes a pre-existing leak — reset never disposed interaction). Only loads the
// module when it was actually booted (so the dynamic import resolves from cache).
export function disposeInteractionOnReset() {
  if ( !_interactionInited ) {
    return;
  }

  _interactionInited = false;
  import( "./interaction/index.js" )
    .then( ( mod ) => mod.disposeInteraction() )
    .catch( () => {} );
}

// The per-slide-merged sketch settings object the bindings live on.
function liveSketchBase( live ) {
  if ( typeof window !== "undefined" && window.getSketchSettings ) {
    try {
      return window.getSketchSettings( live );
    } catch {
      return live.sketch ?? {};
    }
  }

  return live.sketch ?? {};
}

// The generator context: the loop-normalized progression (deterministic during
// recording) plus the frame as a fallback for non-looping sketches.
function bindingContext() {
  let progression;

  try {
    progression = animation.progression;
  } catch {
    progression = undefined;
  }

  return {
    progression,
    frame: getP5()?.frameCount
  };
}

// Sample the interaction channels once per frame and publish them, plus each
// active binding's resolved 0..1 signal (keyed by target) for the UI's VU
// meters. Runs for every sketch; `sampleChannels` is memoized per frame and the
// binding-signal pass is skipped entirely when a sketch has no bindings.
function publishChannelsFrame() {
  if ( !BINDINGS_ENABLED ) {
    return;
  }

  try {
    const base = liveSketchBase( getSketchOptions() );
    const channels = sampleChannels( base?.interaction );

    publishChannels( channels );

    if ( base && Array.isArray( base.bindings ) && base.bindings.length > 0 ) {
      publishBindingSignals( computeBindingSignals(
        base,
        channels,
        bindingContext()
      ) );
    }
  } catch {
    // Never let telemetry break the draw loop.
  }
}

/**
 * Update the previous-options baseline to match the given effective
 * size/animation.  Called by slides/index.js after a slide switch so
 * that the next handleOptionsChange comparison starts from the right
 * baseline and doesn't re-fire events for values that were already applied.
 */
export function syncEffectivePrevious(
  effectiveSize, effectiveAnimation
) {
  if ( effectiveSize ) {
    previousOptions.effectiveSize = {
      ...effectiveSize
    };
  }

  if ( effectiveAnimation ) {
    previousOptions.effectiveAnimation = {
      ...effectiveAnimation
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Proxy — always reads from the live store on every access.         */
/*                                                                    */
/*  .sketch  returns base sketch options merged with per-slide        */
/*           overrides via window.getSketchSettings when registered.  */
/*           Falls back to the raw store value for simple sketches.    */
/*           Interactive bindings are then resolved on top, so any     */
/*           parameter the user has bound to a live input (mouse,      */
/*           oscillator, …) reads its modulated value here — with no   */
/*           per-sketch code and zero overhead when no binding exists. */
/* ------------------------------------------------------------------ */

// Resolve the per-slide-merged sketch object, then layer interactive bindings
// over it. `resolveBindings` returns the same object untouched when the sketch
// declares no bindings, so non-interactive sketches pay nothing.
function resolveSketch( live ) {
  const base = liveSketchBase( live );

  if (
    !BINDINGS_ENABLED ||
    !base ||
    !Array.isArray( base.bindings ) ||
    base.bindings.length === 0
  ) {
    return base;
  }

  try {
    const context = bindingContext();

    return resolveBindings(
      base,
      sampleChannels( base.interaction ),
      context.frame,
      context
    );
  } catch {
    // Binding resolution must never break a sketch — fall back to base values.
    return base;
  }
}

const optionsProxy = new Proxy(
  {},
  {
    get(
      _, prop
    ) {
      const live = getSketchOptions();

      if ( prop === "sketch" ) {
        return resolveSketch( live );
      }

      return live[ prop ];
    }
  }
);

export default optionsProxy;
