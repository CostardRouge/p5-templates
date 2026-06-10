import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import shapes from "@/p5/utils/shapes.js";
import mediapipe from "@/p5/utils/mediapipe/mediapipe.js";
import {
  getP5
} from "@/p5/utils/sketch.js";
import {
  initInteraction,
  disposeInteraction,
  getPointersDebug,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";

// Color palette per source (RGB)
const SOURCE_COLORS = {
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

const SOURCE_LABELS = {
  mouse: "Mouse",
  touch: "Touch",
  hands: "Hands (MediaPipe)",
  fingers: "Fingers (MediaPipe)",
  face: "Face (MediaPipe)",
  body: "Body (MediaPipe)",
  orbit: "Orbit",
  perlinNoise: "Perlin Noise",
  gyroscope: "Gyroscope",
  midi: "MIDI",
  audio: "Audio (Mic)",
  joypad: "Joypad / Gamepad"
};

sketch.setup( async() => {
  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const interaction = options.sketch?.interaction ?? {};
  const viz = interaction.visualization ?? {};
  const bg = options.sketch?.backgroundColor ?? [
    20,
    20,
    20
  ];

  p.clear();
  p.background( ...bg );

  const pointers = getPointersDebug( interaction );

  // ── Draw crosshair lines ───────────────────────────────────────────────
  if ( viz.enabled !== false && viz.showLines ) {
    const w = viz.linesStrokeWeight ?? 1;

    pointers.forEach( ( {
      vector, source
    } ) => {
      const col = SOURCE_COLORS[ source ] ?? [
        200,
        200,
        200
      ];

      p.stroke(
        ...col,
        55
      );
      p.strokeWeight( w );
      shapes.vl( vector.x );
      shapes.hl( vector.y );
    } );
  }

  // ── Draw finger chains ─────────────────────────────────────────────────
  // Each detected finger is one ordered group (base → tip); draw it as a
  // polyline so the per-finger ordering is visible, not just the joints.
  if ( interaction.vision?.enabled !== false && interaction.vision?.fingers?.enabled ) {
    getPointerGroups( interaction )
      .filter( ( group ) => group.source === "fingers" )
      .forEach( ( group ) => {
        p.noFill();
        p.stroke(
          ...SOURCE_COLORS.fingers,
          160
        );
        p.strokeWeight( 3 );
        p.beginShape();
        group.points.forEach( ( v ) => p.vertex(
          v.x,
          v.y
        ) );
        p.endShape();
      } );
  }

  // ── Draw pointer circles ───────────────────────────────────────────────
  pointers.forEach( ( {
    vector, source
  } ) => {
    const col = SOURCE_COLORS[ source ] ?? [
      200,
      200,
      200
    ];
    const x = vector.x;
    const y = vector.y;

    // Finger joints come 21 per hand — draw them smaller to stay readable.
    const ringSize = source === "fingers" ? 22 : 56;
    const dotSize = source === "fingers" ? 5 : 12;

    // Outer ring
    p.noFill();
    p.stroke(
      ...col,
      200
    );
    p.strokeWeight( 1.5 );
    p.circle(
      x,
      y,
      ringSize
    );

    // Center dot
    p.noStroke();
    p.fill( ...col );
    p.circle(
      x,
      y,
      dotSize
    );
  } );

  // ── Webcam preview (top-right) ─────────────────────────────────────────
  const vision = interaction.vision;

  if ( vision?.camera?.showPreview && mediapipe.capture?.element ) {
    const previewW = p.width / 5;
    const previewH = p.height / 5;

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
  }

  // ── Legend / stats (top-left) ──────────────────────────────────────────
  _drawLegend(
    p,
    pointers,
    interaction
  );
} );

function _drawLegend(
  p, pointers, interaction
) {
  const counts = {};

  pointers.forEach( ( {
    source
  } ) => {
    counts[ source ] = ( counts[ source ] ?? 0 ) + 1;
  } );

  const sources = Object.keys( SOURCE_COLORS );
  const lineH = 20;
  const startX = 14;
  let y = 18;

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
    const col = SOURCE_COLORS[ source ];
    const label = SOURCE_LABELS[ source ] ?? source;

    // Dot indicator
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

    // Label
    p.fill( active ? 220 : 90 );
    p.text(
      active ? `${ label } (${ count })` : label,
      startX + 16,
      y
    );

    y += lineH;
  } );

  // Camera hint when vision enabled but mediapipe not yet running
  const vision = interaction.vision;
  const needsCamera = vision?.hands?.enabled || vision?.fingers?.enabled || vision?.face?.enabled || vision?.body?.enabled;
  const cameraRunning = !!mediapipe.capture?.element;

  if ( needsCamera && !cameraRunning && vision?.enabled !== false ) {
    p.fill(
      251,
      188,
      4,
      180
    );
    p.textSize( 11 );
    p.text(
      "⚠ Reload to start camera",
      startX,
      y + 8
    );
  }
}
