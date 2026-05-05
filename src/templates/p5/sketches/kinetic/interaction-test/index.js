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
  getPointersDebug
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
  vision: [
    234,
    67,
    53
  ], // red
  orbit: [
    251,
    188,
    4
  ], // yellow
  perlinNoise: [
    0,
    188,
    168
  ], // teal
  gyroscope: [
    156,
    39,
    176
  ] // purple
};

const SOURCE_LABELS = {
  mouse: "Mouse",
  touch: "Touch",
  vision: "Vision (hands/face/body)",
  orbit: "Orbit",
  perlinNoise: "Perlin Noise",
  gyroscope: "Gyroscope"
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
      56
    );

    // Center dot
    p.noStroke();
    p.fill( ...col );
    p.circle(
      x,
      y,
      12
    );
  } );

  // ── Webcam preview (top-right) ─────────────────────────────────────────
  if ( interaction.vision?.camera?.showPreview && mediapipe.capture?.element ) {
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

  // Reload hint when vision enabled but mediapipe not yet running
  const vision = interaction.vision;
  const needsCamera = vision?.hands?.enabled || vision?.face?.enabled || vision?.body?.enabled;
  const cameraRunning = !!mediapipe.capture?.element;

  if ( needsCamera && !cameraRunning ) {
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
