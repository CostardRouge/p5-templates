// ─────────────────────────────────────────────────────────────────────────────
// HAND CLIP — the portable format for pre-recorded hand-landmark motion.
//
// A hand clip is a short take of one tracked hand (a pinch-and-drag, a wave, a
// grab), captured from MediaPipe landmarks in the hand-clip studio, cleaned and
// resampled offline to a UNIFORM frame rate, and stored as a versioned .json.
// Replayed as hand-shaped groups (`{ id, points }`, trailing five points =
// fingertips in MediaPipe order) a clip pinches, drags and renders exactly like
// a live hand — the seam pinchMath.js/handPinch.js were designed around.
//
// This module owns the FORMAT and deliberately nothing else:
//
//   1. Shape       — a runtime clip is `{ name, …, frames: Float32Array }`
//      where `frames` is flat `frameCount × pointCount × 2` normalized
//      coordinates (0..1 in the capture frame, x already in display
//      orientation). Uniform fps means playback is an index + a lerp; all the
//      expensive cleaning happened once, at bake time (see
//      utils/interaction/handClips/process.js).
//   2. Portability — `serializeHandClip` / `parseHandClip` /
//      `downloadHandClip` move clips through the versioned `p5t-handclip`
//      .json format. Coordinates are stored as quantized integers
//      (× `quant`, default 4096 — sub-pixel at 4K): compact JSON, fast parse,
//      good gzip.
//   3. Conventions — the two point layouts and where the thumb/index tips sit
//      in each, plus the tip-gap helper phase detection and pinch calibration
//      are built on.
//
// The module is intentionally import-free: it runs unchanged in the browser,
// in the headless recording pipeline, and under plain Node — same contract as
// shared/wavetable.js, whose format this one mirrors.
// ─────────────────────────────────────────────────────────────────────────────

export const HAND_CLIP_FORMAT = "p5t-handclip";
export const HAND_CLIP_VERSION = 1;

/**
 * The runtime clip shape — what `parseHandClip` returns and
 * `serializeHandClip` expects. Declared as JSDoc so TypeScript consumers
 * (tests, the studio) see the real shape through the JS module boundary.
 *
 * @typedef {{ enter: number[], close: number, drag: number[], open: number,
 *   exit: number[] }} HandClipPhases
 * @typedef {{ grab: { x: number, y: number },
 *   release: { x: number, y: number } }} HandClipAnchors
 * @typedef {object} HandClip
 * @property {string} name
 * @property {string[]} tags
 * @property {string} handedness
 * @property {number} fps - Actual uniform frame rate of `frames`.
 * @property {number} frameCount
 * @property {string} layout - A HAND_CLIP_LAYOUTS key.
 * @property {number} aspect - Capture frame aspect (width / height).
 * @property {number} quant - Quantization step used by the stored form.
 * @property {Float32Array} frames - Flat frameCount × pointCount × 2
 *   normalized coordinates.
 * @property {HandClipPhases|null} phases
 * @property {HandClipAnchors|null} anchors
 * @property {number[]|null} gapRange - [min, max] thumb/index gap.
 * @property {{ sourceFps: number, samples: number,
 *   recordedAt: string|null }|null} capture
 */

// Default quantization step for stored coordinates: round( value × 4096 ).
export const HAND_CLIP_QUANT = 4096;

// Point layouts a clip can store. Indices mirror the MediaPipe hand model —
// kept in sync with HAND_FINGERTIP_INDICES / HAND_PALM_INDEX in
// utils/interaction/index.js, which this import-free module must not import.
//
//   landmarks-21 — the full MediaPipe hand (wrist = 0, thumb tip = 4,
//                  index tip = 8, …). Needed to draw a real skeleton/ribbon.
//   tips-6       — palm + the five fingertips (thumb, index, middle, ring,
//                  pinky), i.e. exactly the hand-shaped group the interaction
//                  layer emits. 3.5× smaller; enough to pinch, not to render
//                  a full hand.
export const HAND_CLIP_LAYOUTS = {
  "landmarks-21": {
    pointCount: 21,
    palm: 0,
    thumbTip: 4,
    indexTip: 8,
    fingertips: [
      4,
      8,
      12,
      16,
      20
    ]
  },
  "tips-6": {
    pointCount: 6,
    palm: 0,
    thumbTip: 1,
    indexTip: 2,
    fingertips: [
      1,
      2,
      3,
      4,
      5
    ]
  }
};

/** Layout descriptor for a clip (or a layout name), or throws on unknown. */
export function handClipLayout( clipOrLayout ) {
  const name = typeof clipOrLayout === "string" ? clipOrLayout : clipOrLayout?.layout;
  const layout = HAND_CLIP_LAYOUTS[ name ];

  if ( !layout ) {
    throw new Error( `handClipLayout: unknown layout "${ name }".` );
  }

  return layout;
}

/**
 * Thumb-tip / index-tip gap of one frame, in normalized units. The series of
 * gaps over a clip is what phase detection latches on, and its range is what
 * calibrates a playback `handScale` against a sketch's `pinch` threshold
 * (gap px = gap normalized × hand scale in px).
 */
export function handClipGap(
  clip, frame
) {
  const layout = handClipLayout( clip );
  const base = frame * layout.pointCount * 2;
  const thumb = base + layout.thumbTip * 2;
  const index = base + layout.indexTip * 2;

  return Math.hypot(
    clip.frames[ thumb ] - clip.frames[ index ],
    clip.frames[ thumb + 1 ] - clip.frames[ index + 1 ]
  );
}

/**
 * Serialise a runtime clip to the portable .json format. Coordinates are
 * stored as `round( value × quant )` integers — lossless to ~0.4 px on a
 * 1600 px canvas at the default quant, far below tracking noise, and the
 * integer array keeps files small enough to commit next to a sketch or paste
 * into the options form's json field.
 */
export function serializeHandClip( clip ) {
  const layout = handClipLayout( clip );
  const quant = clip.quant ?? HAND_CLIP_QUANT;
  const expected = clip.frameCount * layout.pointCount * 2;

  if ( !clip.frames || clip.frames.length !== expected ) {
    throw new Error( `serializeHandClip: frames length ${ clip.frames?.length ?? 0 } does not match frameCount × pointCount × 2 = ${ expected }.` );
  }

  return JSON.stringify(
    {
      format: HAND_CLIP_FORMAT,
      version: HAND_CLIP_VERSION,
      name: clip.name ?? "untitled",
      tags: Array.isArray( clip.tags ) ? clip.tags : [],
      handedness: clip.handedness ?? "",
      fps: clip.fps,
      frameCount: clip.frameCount,
      layout: clip.layout,
      space: "normalized",
      aspect: clip.aspect,
      quant,
      phases: clip.phases ?? null,
      anchors: clip.anchors ?? null,
      gapRange: clip.gapRange ?? null,
      capture: clip.capture ?? null,
      frames: Array.from(
        clip.frames,
        ( value ) => Math.round( value * quant )
      )
    },
    null,
    1
  );
}

/**
 * Parse a .json hand clip (string or already-parsed object) back into a
 * runtime clip: coordinates dequantized into a flat Float32Array, missing
 * derived fields (gapRange) recomputed. Throws on anything that is not a
 * valid clip, so callers can fall back.
 *
 * @returns {HandClip}
 */
export function parseHandClip( source ) {
  const data = typeof source === "string" ? JSON.parse( source ) : source;

  if (
    !data ||
    data.format !== HAND_CLIP_FORMAT ||
    !Array.isArray( data.frames ) ||
    data.frames.length === 0 ||
    !Number.isFinite( data.fps ) ||
    data.fps <= 0
  ) {
    throw new Error( "parseHandClip: not a valid hand-clip .json payload." );
  }

  const layout = handClipLayout( data.layout );
  const stride = layout.pointCount * 2;
  const frameCount = data.frameCount ?? Math.floor( data.frames.length / stride );

  if ( frameCount < 1 || data.frames.length !== frameCount * stride ) {
    throw new Error( `parseHandClip: frames length ${ data.frames.length } does not match frameCount × pointCount × 2 = ${ frameCount * stride }.` );
  }

  const quant = data.quant ?? HAND_CLIP_QUANT;
  const frames = new Float32Array( data.frames.length );

  for ( let i = 0; i < frames.length; i++ ) {
    frames[ i ] = ( Number( data.frames[ i ] ) || 0 ) / quant;
  }

  const clip = {
    name: data.name ?? "untitled",
    tags: Array.isArray( data.tags ) ? data.tags : [],
    handedness: data.handedness ?? "",
    fps: data.fps,
    frameCount,
    layout: data.layout,
    aspect: Number.isFinite( data.aspect ) ? data.aspect : 4 / 3,
    quant,
    frames,
    phases: data.phases ?? null,
    anchors: data.anchors ?? null,
    gapRange: data.gapRange ?? null,
    capture: data.capture ?? null
  };

  if ( !clip.gapRange ) {
    let min = Infinity;
    let max = -Infinity;

    for ( let frame = 0; frame < frameCount; frame++ ) {
      const gap = handClipGap(
        clip,
        frame
      );

      min = Math.min(
        min,
        gap
      );
      max = Math.max(
        max,
        gap
      );
    }

    clip.gapRange = [
      min,
      max
    ];
  }

  return clip;
}

/** Trigger a browser download of the clip as a `.json` file. */
export function downloadHandClip(
  clip, filename
) {
  if ( typeof document === "undefined" ) {
    return;
  }

  const slug = ( clip.name ?? "hand-clip" )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    ) || "hand-clip";
  const blob = new Blob(
    [
      serializeHandClip( clip )
    ],
    {
      type: "application/json"
    }
  );
  const url = URL.createObjectURL( blob );
  const anchor = document.createElement( "a" );

  anchor.href = url;
  anchor.download = filename ?? `${ slug }.handclip.json`;
  document.body.appendChild( anchor );
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL( url );
}
