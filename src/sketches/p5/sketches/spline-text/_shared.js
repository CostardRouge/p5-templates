import {
  getP5
} from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import {
  buildBasePoints,
  animatePoints,
  renderSplines
} from "../splines/_shared.js";

/**
 * Shared engine for the `spline-text` category.
 *
 * The idea: a single spline made of N control points starts life scattered at
 * random positions, drifting on a noise loop ("la spline tourne dans tous les
 * sens"). Over the loop it gathers onto the outline of a word — each control
 * point lerps from its random anchor to a point sampled along the glyph
 * contours — so the spline literally writes itself over the font. Then it
 * releases back to the random cloud and the loop repeats seamlessly.
 *
 * Two assembly modes:
 *   - instant      → every control point morphs together on a single eased clock.
 *   - progressive  → points are revealed left → right (a staggered window keyed
 *                    on each target's x), so the word is written letter by letter.
 *
 * Rendering reuses the `splines` category's neon look (`renderSplines`), so the
 * curve method (chaikin / catmull-rom / quadratic), the glow and the rainbow
 * stroke options are all shared with that category instead of reinvented here.
 */

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

function resolveFont( name ) {
  return string.fonts[ name ] ?? string.fonts.sans;
}

// Base (un-drifted) random layout, rebuilt only when count / seed / canvas size
// change — same caching trick the splines and neon sketches use for their grids.
const baseState = {
  points: [],
  key: ""
};

function ensureBasePoints(
  count, seed
) {
  const p = getP5();
  const key = `${ count }-${ seed }-${ p.width }x${ p.height }`;

  if ( key !== baseState.key ) {
    baseState.key = key;
    baseState.points = buildBasePoints( {
      count,
      seed,
      layout: "random"
    } );
  }

  return baseState.points;
}

/**
 * Resample an ordered point list down/up to exactly `count` points, preserving
 * order so the spline still traces the glyph contours. textToPoints emits points
 * glyph by glyph in reading order, so an evenly indexed subsample keeps the
 * left-to-right letter ordering the progressive reveal relies on.
 */
export function resampleOrdered(
  points, count
) {
  const n = points.length;
  const out = [];

  for ( let i = 0; i < count; i++ ) {
    const idx = Math.min(
      n - 1,
      Math.floor( i * n / count )
    );

    out.push( points[ idx ] );
  }

  return out;
}

// Bounded memo for the resampled, positioned target clouds. Mirrors
// traceLetters' approach: the geometry only depends on the signature below, and
// renderSplines / lerpVector copy before mutating, so sharing the vectors across
// frames is safe. Empty results (font still loading) are deliberately NOT cached
// so the targets appear as soon as the font resolves.
const TARGET_MEMO_MAX = 64;
const targetMemo = new Map();

function getTextTargets( {
  text,
  font,
  size,
  sampleFactor,
  simplifyThreshold,
  count,
  position
} ) {
  const fontFamily = font?.name || font?.face?.family || "unknown";
  const key = [
    text,
    fontFamily,
    "spline-text",
    size,
    sampleFactor,
    simplifyThreshold,
    count,
    Math.round( position.x ),
    Math.round( position.y )
  ].join( "-" );

  const cached = targetMemo.get( key );

  if ( cached && cached.length ) {
    return cached;
  }

  const raw = string.getTextPoints( {
    text,
    size,
    font,
    position,
    sampleFactor,
    simplifyThreshold
  } );

  if ( !raw.length ) {
    return [];
  }

  const resampled = resampleOrdered(
    raw,
    count
  );

  targetMemo.set(
    key,
    resampled
  );

  if ( targetMemo.size > TARGET_MEMO_MAX ) {
    targetMemo.delete( targetMemo.keys().next().value );
  }

  return resampled;
}

/**
 * The overall "how assembled is the word" amount across one loop:
 *   assemble → ramp 0→1, hold → stay at 1 (word fully formed), dissolve → 1→0.
 * The dissolve takes whatever is left of the loop. Because the random anchors
 * drift on a seamless noise loop, returning to 0 at the end matches the start,
 * so the loop is seamless.
 */
export function morphEnvelope(
  progression, assemble, hold
) {
  if ( progression < assemble ) {
    return assemble <= 0 ? 1 : progression / assemble;
  }

  if ( progression < assemble + hold ) {
    return 1;
  }

  const dissolve = 1 - assemble - hold;

  if ( dissolve <= 0 ) {
    return 1;
  }

  return Math.max(
    0,
    1 - ( progression - assemble - hold ) / dissolve
  );
}

/**
 * Per-point progress. `spread` (0 = instant, →1 = fully sequential) slides a
 * window across the points ordered by `key`: at global 0 every point is 0, at
 * global 1 every point is 1, and a point with a smaller key (further left)
 * finishes first — the handwriting reveal.
 */
export function staggeredProgress(
  global, key, spread
) {
  if ( spread <= 0 ) {
    return global;
  }

  const start = key * spread;
  const span = 1 - spread;

  return clamp(
    ( global - start ) / span,
    0,
    1
  );
}

// Normalised x of each target (0 = leftmost, 1 = rightmost) → the reveal order
// for the progressive mode, so the word is written left to right.
function staggerKeys( targets ) {
  if ( targets.length === 0 ) {
    return [];
  }

  let min = Infinity;
  let max = -Infinity;

  for ( const target of targets ) {
    if ( target.x < min ) {
      min = target.x;
    }

    if ( target.x > max ) {
      max = target.x;
    }
  }

  const span = max - min || 1;

  return targets.map( ( target ) => ( target.x - min ) / span );
}

/**
 * The literal glyph drawn underneath the spline, aligned to the exact same
 * bounding-box centre `getTextPoints` uses, so the text and the traced spline
 * sit on top of each other. Optionally fades in with the morph so the word only
 * appears as the spline gathers onto it, and can be hidden entirely.
 */
function drawText( {
  text,
  font,
  size,
  position,
  cfg,
  envelope
} ) {
  // p5 v2: glyph data readiness lives on `font.data` (was `font.font`).
  if ( !font?.data || !text.length ) {
    return;
  }

  const p = getP5();
  const color = cfg.color ?? [
    255,
    255,
    255,
    90
  ];
  const alpha = ( color[ 3 ] ?? 255 ) * ( cfg.fade ? envelope : 1 );

  if ( alpha <= 0 ) {
    return;
  }

  // Match getTextPoints: offset so the glyph bounding-box centre lands on
  // `position` (textToPoints/textBounds share the same metrics).
  const bounds = string.textBounds(
    font,
    text,
    0,
    0,
    size
  );
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;

  p.push();
  p.noStroke();
  p.fill(
    color[ 0 ],
    color[ 1 ],
    color[ 2 ],
    alpha
  );
  p.textFont( font );
  p.textSize( size );
  p.textAlign(
    p.LEFT,
    p.BASELINE
  );
  p.text(
    text,
    position.x - cx,
    position.y - cy
  );
  p.pop();
}

// Cache of the "travelling detail" decimation, shared by both spline-text
// engines. Away from the word (the random cloud here, the word-to-word crossing
// in the reading engine) the curve should read as a much simpler, lower-point
// spline so the canvas isn't filled with strands ("spaghetti") — yet the moment
// it settles on a word it must show the full glyph outline. We never change the
// vertex count (that would pop): an evenly spaced subset stays "structural" while
// the rest collapse onto the chord between their two structural neighbours when
// off the word, then ease back to their real outline position as it arrives.
// Rebuilt only when the point count or the detail ratio change.
const detailState = {
  key: "",
  structural: null,
  prev: null,
  next: null,
  t: null
};

export function ensureDetailMap(
  count, detail
) {
  const key = `${ count }|${ detail }`;

  if ( key === detailState.key ) {
    return detailState;
  }

  // How many points stay structural off the word (always at least the two
  // endpoints, at most every point — in which case nothing collapses).
  const kept = clamp(
    Math.round( count * detail ),
    2,
    count
  );
  const structural = new Uint8Array( count );

  for ( let s = 0; s < kept; s++ ) {
    structural[ Math.round( s * ( count - 1 ) / ( kept - 1 ) ) ] = 1;
  }

  structural[ 0 ] = 1;
  structural[ count - 1 ] = 1;

  // For every point: the nearest structural index at or before it, the nearest at
  // or after it, and where it sits between the two (so fillers land on the chord).
  const prev = new Int32Array( count );
  const next = new Int32Array( count );
  const t = new Float32Array( count );

  for ( let i = 0, last = 0; i < count; i++ ) {
    if ( structural[ i ] ) {
      last = i;
    }

    prev[ i ] = last;
  }

  for ( let i = count - 1, upcoming = count - 1; i >= 0; i-- ) {
    if ( structural[ i ] ) {
      upcoming = i;
    }

    next[ i ] = upcoming;
  }

  for ( let i = 0; i < count; i++ ) {
    const span = next[ i ] - prev[ i ];

    t[ i ] = span > 0 ? ( i - prev[ i ] ) / span : 0;
  }

  detailState.key = key;
  detailState.structural = structural;
  detailState.prev = prev;
  detailState.next = next;
  detailState.t = t;

  return detailState;
}

/**
 * Collapse the "filler" control points onto the chord between their structural
 * neighbours by `amount` (0 = untouched full detail, 1 = fully simplified), using
 * a map from `ensureDetailMap`. Returns a new point list; structural points pass
 * through unchanged so the curve keeps its overall shape and never pops.
 */
export function applyTravelDetail(
  points, map, amount
) {
  if ( amount <= 0 ) {
    return points;
  }

  return points.map( (
    point, i
  ) => {
    if ( map.structural[ i ] ) {
      return point;
    }

    const chord = mappers.lerpVector(
      points[ map.prev[ i ] ],
      points[ map.next[ i ] ],
      map.t[ i ]
    );

    return mappers.lerpVector(
      point,
      chord,
      amount
    );
  } );
}

/**
 * Draw one frame of the spline-text sketch from a resolved `sketch` options
 * object. Both category variants (instant / progressive defaults) call this so
 * they share exactly the same behaviour and only differ by their form defaults.
 */
export function renderSplineText( o = {} ) {
  const p = getP5();
  const pointsCfg = o.points ?? {};
  const textCfg = o.text ?? {};
  const morphCfg = o.morph ?? {};

  const count = Math.max(
    3,
    Math.round( pointsCfg.count ?? 55 )
  );
  const seed = pointsCfg.seed ?? 7;

  // 1. Random anchors: a seeded layout drifting on a noise loop.
  const base = ensureBasePoints(
    count,
    seed
  );
  const anchors = animatePoints(
    base,
    {
      motion: pointsCfg.motion ?? 0.08,
      speed: pointsCfg.speed ?? 1,
      seed,
      angle: animation.angle
    }
  );

  // 2. Text targets: the glyph outline resampled to `count` ordered points.
  const position = p.createVector(
    p.width / 2,
    p.height / 2
  );
  const font = resolveFont( textCfg.font );
  const size = ( textCfg.size ?? 0.2 ) * Math.min(
    p.width,
    p.height
  );
  const text = ( textCfg.value ?? "" ).toString();
  const targets = text.trim().length
    ? getTextTargets( {
      text,
      font,
      size,
      sampleFactor: textCfg.sampleFactor ?? 0.2,
      simplifyThreshold: textCfg.simplifyThreshold ?? 0,
      count,
      position
    } )
    : [];

  // 3. Morph: a loop-wide envelope, optionally staggered per point.
  const assemble = clamp(
    morphCfg.assemble ?? 0.35,
    0,
    1
  );
  const hold = clamp(
    morphCfg.hold ?? 0.2,
    0,
    Math.max(
      0,
      1 - assemble
    )
  );
  const envelope = morphEnvelope(
    animation.progression,
    assemble,
    hold
  );
  const easeFn = easing[ morphCfg.easing ] ?? easing.easeInOutCubic;
  const spread = morphCfg.mode === "progressive"
    ? clamp(
      morphCfg.spread ?? 0.6,
      0,
      0.95
    )
    : 0;
  const keys = spread > 0 ? staggerKeys( targets ) : null;

  let current = anchors.map( (
    anchor, index
  ) => {
    const target = targets[ index ];

    if ( !target ) {
      return anchor;
    }

    const progress = easeFn( staggeredProgress(
      envelope,
      keys ? keys[ index ] : 0,
      spread
    ) );

    return mappers.lerpVector(
      anchor,
      target,
      progress
    );
  } );

  // Declutter the cloud: `travelDetail` is the fraction of points kept away from
  // the word (1 = the full, busy cloud; small = a clean, sparse strand). The word
  // is always traced at full detail — `envelope` is 1 there, so the simplification
  // (driven by 1 − envelope) fades fully out as the spline gathers onto the glyph.
  const detail = clamp(
    pointsCfg.travelDetail ?? 0.2,
    0,
    1
  );

  if ( detail < 1 && count > 2 ) {
    current = applyTravelDetail(
      current,
      ensureDetailMap(
        count,
        detail
      ),
      1 - envelope
    );
  }

  // 4. The literal word underneath (optional / fades with the morph).
  if ( textCfg.visible ?? true ) {
    drawText( {
      text,
      font,
      size,
      position,
      cfg: textCfg,
      envelope
    } );
  }

  // 5. The spline itself, with the shared neon look.
  if ( current.length >= 2 ) {
    renderSplines(
      [
        current
      ],
      {
        curve: o.curve ?? {},
        stroke: o.stroke ?? {},
        overlay: o.overlay ?? {}
      }
    );
  }
}
