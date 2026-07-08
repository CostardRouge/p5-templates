// ── Shared interaction debug overlay ──────────────────────────────────────
// Drawing helpers any interactive sketch can stack on top of its scene so the
// user can see, debug and demo what the interaction layer is producing:
// crosshair lines, pointer markers, finger chains, the webcam preview and a
// per-source legend. Everything is gated by the same `interaction` options
// block that drives the layer itself (see ./defaults.js → visualization, and
// vision.camera.showPreview), so the form already controls it.
//
// Drop one call to `drawInteractionOverlay(opts)` at the end of a sketch.draw
// and the overlay renders on top, leaving the sketch's own visuals underneath.

import mediapipe from "@/p5/utils/mediapipe/mediapipe.js";
import shapes from "@/p5/utils/shapes.js";
import {
  getP5
} from "@/p5/utils/sketch.js";
import {
  getPointersDebug,
  getPointerGroups
} from "./index.js";

// Per-source colour palette (RGB). Shared so the legend dot, the crosshair,
// the pointer ring and the finger chain are all the same colour for one source.
export const INTERACTION_SOURCE_COLORS = {
  mouse: [
    66,
    133,
    244
  ], // blue
  touch: [
    52,
    168,
    83
  ], // green
  hands: [
    255,
    109,
    0
  ], // orange
  fingers: [
    139,
    195,
    74
  ], // light green
  face: [
    233,
    30,
    99
  ], // pink
  faceMesh: [
    236,
    64,
    122
  ], // rose
  body: [
    0,
    188,
    212
  ], // cyan
  orbit: [
    251,
    188,
    4
  ], // yellow
  perlinNoise: [
    0,
    150,
    136
  ], // teal
  gyroscope: [
    96,
    125,
    139
  ], // blue-grey
  midi: [
    156,
    39,
    176
  ], // purple
  audio: [
    244,
    67,
    54
  ], // red
  joypad: [
    77,
    182,
    172
  ] // teal-green
};

export const INTERACTION_SOURCE_LABELS = {
  mouse: "Mouse",
  touch: "Touch",
  hands: "Hands (MediaPipe)",
  fingers: "Fingers (MediaPipe)",
  face: "Face (MediaPipe)",
  faceMesh: "Face mesh (MediaPipe)",
  body: "Body (MediaPipe)",
  orbit: "Orbit",
  perlinNoise: "Perlin Noise",
  gyroscope: "Gyroscope",
  midi: "MIDI",
  audio: "Audio (Mic)",
  joypad: "Joypad / Gamepad"
};

const DEFAULT_COLOR = [
  200,
  200,
  200
];

function _sourceColor( source ) {
  return INTERACTION_SOURCE_COLORS[ source ] ?? DEFAULT_COLOR;
}

/**
 * Crosshair lines (full-width and full-height) anchored on each pointer,
 * coloured by source. Gated by `visualization.showLines`.
 */
export function drawInteractionCrosshairs( opts ) {
  const viz = opts?.visualization ?? {};

  if ( viz.enabled === false || !viz.showLines ) {
    return;
  }

  const p = getP5();
  const w = viz.linesStrokeWeight ?? 1;
  const pointers = getPointersDebug( opts );

  p.push();
  p.strokeWeight( w );

  pointers.forEach( ( {
    vector, source
  } ) => {
    const col = _sourceColor( source );

    p.stroke(
      ...col,
      55
    );
    shapes.vl( vector.x );
    shapes.hl( vector.y );
  } );

  p.pop();
}

/**
 * Finger joint chains drawn as polylines (base → tip) so per-finger ordering is
 * visible, not just the bare joints. Only renders when fingers tracking is on.
 */
export function drawInteractionFingerChains( opts ) {
  const vision = opts?.vision;

  if ( vision?.enabled === false || !vision?.fingers?.enabled ) {
    return;
  }

  const p = getP5();

  p.push();
  p.noFill();
  p.stroke(
    ...INTERACTION_SOURCE_COLORS.fingers,
    160
  );
  p.strokeWeight( 3 );

  getPointerGroups( opts )
    .filter( ( group ) => group.source === "fingers" )
    .forEach( ( group ) => {
      p.beginShape();
      group.points.forEach( ( v ) => p.vertex(
        v.x,
        v.y
      ) );
      p.endShape();
    } );

  p.pop();
}

/**
 * Face-mesh point cloud — the 468 FaceLandmarker points per face drawn as small
 * dots (the classic MediaPipe FaceMesh look). Gated by `vision.faceMesh.drawOverlay`.
 */
export function drawInteractionFaceMesh( opts ) {
  const vision = opts?.vision;

  if ( vision?.enabled === false || !vision?.faceMesh?.enabled || !vision?.faceMesh?.drawOverlay ) {
    return;
  }

  const p = getP5();

  p.push();
  p.noStroke();
  p.fill(
    ...INTERACTION_SOURCE_COLORS.faceMesh,
    200
  );

  getPointerGroups( opts )
    .filter( ( group ) => group.source === "faceMesh" )
    .forEach( ( group ) => {
      group.points.forEach( ( v ) => p.circle(
        v.x,
        v.y,
        3
      ) );
    } );

  p.pop();
}

/**
 * Pointer markers — an outer ring + a centre dot — coloured per source. Finger
 * joints come 21 per hand so they shrink to stay readable.
 */
export function drawInteractionPointers( opts ) {
  const viz = opts?.visualization ?? {};

  if ( viz.enabled === false || viz.showPointers === false ) {
    return;
  }

  const p = getP5();
  const pointers = getPointersDebug( opts );

  pointers.forEach( ( {
    vector, source
  } ) => {
    const col = _sourceColor( source );
    const ringSize = source === "fingers" ? 22 : 56;
    const dotSize = source === "fingers" ? 5 : 12;

    p.noFill();
    p.stroke(
      ...col,
      200
    );
    p.strokeWeight( 1.5 );
    p.circle(
      vector.x,
      vector.y,
      ringSize
    );

    p.noStroke();
    p.fill( ...col );
    p.circle(
      vector.x,
      vector.y,
      dotSize
    );
  } );
}

/**
 * Vision-source preview in the top-right corner (webcam, or the video/image
 * asset inference runs on). Gated by `vision.source.showPreview` — with a
 * fallback to the legacy `vision.camera.showPreview`.
 */
export function drawInteractionCameraPreview( opts ) {
  const vision = opts?.vision;
  const showPreview =
    vision?.source?.showPreview ?? vision?.camera?.showPreview;

  if ( !showPreview || !mediapipe.capture?.element ) {
    return;
  }

  const p = getP5();
  const previewW = p.width / 5;
  const previewH = p.height / 5;

  if ( mediapipe.capture.owned ) {
    p.push();
    p.tint(
      255,
      160
    );
    p.image(
      mediapipe.capture.element,
      p.width - previewW - 8,
      8,
      previewW,
      previewH
    );
    p.pop();
  } else {
    // Adopted video/image source: capture holds a bare { elt } wrapper, not
    // a p5.MediaElement, so p.image() can't draw it — blit the raw element
    // instead (2D renderer only; WEBGL has no drawImage on its context).
    const elt = mediapipe.capture.element.elt;

    if ( elt && typeof p.drawingContext?.drawImage === "function" ) {
      try {
        p.drawingContext.drawImage(
          elt,
          p.width - previewW - 8,
          8,
          previewW,
          previewH
        );
      } catch {
        // Frame not decodable yet — skip this frame's preview.
      }
    }
  }

  p.push();
  p.noFill();
  p.stroke(
    255,
    60
  );
  p.strokeWeight( 1 );
  p.rect(
    p.width - previewW - 8,
    8,
    previewW,
    previewH
  );
  p.pop();
}

/**
 * Top-left legend listing every source with its per-frame pointer count, plus
 * a vision-status line (starting hint or live inference stats). Disable with
 * `visualization.showLegend === false`.
 */
export function drawInteractionLegend( opts ) {
  const viz = opts?.visualization ?? {};

  if ( viz.enabled === false || viz.showLegend === false ) {
    return;
  }

  const p = getP5();
  const pointers = getPointersDebug( opts );
  const counts = {};

  pointers.forEach( ( {
    source
  } ) => {
    counts[ source ] = ( counts[ source ] ?? 0 ) + 1;
  } );

  const sources = Object.keys( INTERACTION_SOURCE_COLORS );
  const lineH = 20;
  const startX = 14;
  let y = 18;

  p.push();
  p.textSize( 12 );
  p.textAlign(
    p.LEFT,
    p.CENTER
  );
  p.noStroke();

  // Total
  p.fill(
    255,
    200
  );
  p.text(
    `${ pointers.length } pointer${ pointers.length !== 1 ? "s" : "" }`,
    startX,
    y
  );
  y += lineH + 4;

  sources.forEach( ( source ) => {
    const count = counts[ source ] ?? 0;
    const active = count > 0;
    const col = INTERACTION_SOURCE_COLORS[ source ];
    const label = INTERACTION_SOURCE_LABELS[ source ] ?? source;

    p.fill( active ? col : [
      80,
      80,
      80
    ] );
    p.circle(
      startX + 5,
      y,
      8
    );

    p.fill( active ? 220 : 90 );
    p.text(
      active ? `${ label } (${ count })` : label,
      startX + 16,
      y
    );

    y += lineH;
  } );

  // Vision status: starting hint, then live inference stats once running.
  const vision = opts?.vision;
  const needsCamera = vision?.hands?.enabled || vision?.fingers?.enabled || vision?.face?.enabled || vision?.faceMesh?.enabled || vision?.body?.enabled;

  if ( !needsCamera || vision?.enabled === false ) {
    p.pop();

    return;
  }

  p.textSize( 11 );

  if ( !mediapipe.capture?.element || !mediapipe.processor.ready ) {
    p.fill(
      251,
      188,
      4,
      180
    );
    p.text(
      "Starting camera…",
      startX,
      y + 8
    );
    p.pop();

    return;
  }

  const stats = mediapipe.stats;
  const thread = mediapipe.config.useWorker ? "worker" : "main";
  const state = mediapipe.idle ? " · idle" : "";

  p.fill(
    255,
    140
  );
  p.text(
    `vision: ${ thread } · ${ stats.inferenceMilliseconds.toFixed( 1 ) } ms · ${ stats.inferencesPerSecond.toFixed( 0 ) }/s${ state }`,
    startX,
    y + 8
  );
  p.pop();
}

/**
 * Convenience: draw the full debug overlay on top of the current scene. Each
 * piece is independently gated by the matching `visualization` flag so the user
 * can keep just the parts they want (e.g. crosshairs without the legend).
 *
 * The whole overlay short-circuits when interaction itself or its visualization
 * are disabled, so a sketch can call this unconditionally at the end of draw().
 */
export function drawInteractionOverlay( opts ) {
  if ( !opts || opts.enabled === false ) {
    return;
  }

  const viz = opts.visualization ?? {};

  // The camera preview lives under `vision.camera`, so it stays available even
  // when the visualization block is muted — the preview is the only way to
  // see what the camera is feeding the trackers.
  drawInteractionCameraPreview( opts );

  if ( viz.enabled === false ) {
    return;
  }

  drawInteractionCrosshairs( opts );
  drawInteractionFingerChains( opts );
  drawInteractionFaceMesh( opts );
  drawInteractionPointers( opts );
  drawInteractionLegend( opts );
}
