import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import string from "@/p5/utils/string.js";
import webcam from "@/p5/utils/webcam/index.js";
import {
  getAudio,
  getPointers,
  initInteraction
} from "@/p5/utils/interaction/index.js";

// ── voice-portrait ─────────────────────────────────────────────────────────
// The "turn your sound on" format: the webcam portrait is rebuilt as a coarse
// grid of dots, and the microphone tears it apart. Silence shows a calm,
// legible portrait; every word / beat scatters the dots along their own noise
// rays and pulses their size, so the picture literally dissolves into the
// sound and reassembles in the pauses.
//
//   audio level → scatter (the portrait dissolves as you speak)
//   bass        → dot pulse (size swells on the low end)
//   kick        → an expanding shockwave ring from the canvas center
//
// The mic pipeline is the shared interaction layer (features: bands + kick +
// voice), so the sketch needs no p5.sound and every scalar it reacts to is
// also available to the binding system. The camera is the shared webcam
// capture util — the same picker as everywhere else in the app.

const state = sketch.state( () => ( {
  sampler: null,
  smoothedLevel: 0,
  rings: []
} ) );

let camera = null;

sketch.setup( async() => {
  await initInteraction( options.sketch?.interaction ?? {} );

  camera = webcam.attach( () => options.sketch?.camera );
} );

sketch.draw( () => {
  const p = getP5();

  const interaction = options.sketch?.interaction ?? {};
  const grid = options.sketch?.grid ?? {};
  const reaction = options.sketch?.reaction ?? {};
  const appearance = options.sketch?.appearance ?? {};
  const overlay = options.sketch?.overlay ?? {};
  const background = options.sketch?.backgroundColor ?? [
    8,
    8,
    12
  ];

  p.clear();
  p.background( ...background );

  // Pump the interaction system so this frame's audio features exist.
  getPointers( interaction );

  const audio = getAudio();
  const element = camera?.element();

  if ( !element ) {
    drawHint(
      "click the canvas and allow camera + microphone access",
      background
    );

    return;
  }

  const cells = sampleCamera(
    element,
    grid
  );

  if ( !cells ) {
    return;
  }

  const level = readLevel(
    audio,
    reaction
  );

  updateRings(
    audio,
    reaction
  );

  drawCells(
    cells,
    level,
    audio,
    reaction,
    appearance
  );

  drawRings( appearance );

  if ( overlay.show ?? true ) {
    drawCaption(
      overlay.caption ?? "🔊 turn your sound on",
      background
    );
  }
} );

/**
 * Smoothed 0..1 loudness from the named bands (their mean), with a floor cut
 * so room noise doesn't keep the portrait permanently shredded.
 */
function readLevel(
  audio, reaction
) {
  let level = 0;

  if ( audio.enabled && audio.bands ) {
    const values = Object.values( audio.bands );

    if ( values.length > 0 ) {
      const mean = values.reduce(
        (
          sum, value
        ) => sum + value,
        0
      ) / values.length;

      const floor = reaction.noiseFloor ?? 0.04;

      level = Math.max(
        0,
        ( mean - floor ) / ( 1 - floor )
      );
    }
  }

  const attack = reaction.smoothing ?? 0.25;

  state.smoothedLevel += attack * ( level - state.smoothedLevel );

  return state.smoothedLevel;
}

/**
 * Cover-fit the camera frame into a cells-sized buffer and read it back once —
 * one tiny loadPixels per frame instead of per-cell get() calls.
 */
function sampleCamera(
  element, grid
) {
  const p = getP5();
  const columns = Math.max(
    8,
    Math.round( grid.columns ?? 48 )
  );
  const rows = Math.max(
    8,
    Math.round( columns * p.height / p.width )
  );

  if (
    !state.sampler ||
    state.sampler.width !== columns ||
    state.sampler.height !== rows
  ) {
    state.sampler = p.createGraphics(
      columns,
      rows
    );
    state.sampler.pixelDensity( 1 );
  }

  const sampler = state.sampler;
  const sourceWidth = element.elt?.videoWidth ?? element.width;
  const sourceHeight = element.elt?.videoHeight ?? element.height;

  if ( !sourceWidth || !sourceHeight ) {
    return null;
  }

  const scale = Math.max(
    columns / sourceWidth,
    rows / sourceHeight
  );
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;

  sampler.push();

  if ( grid.mirror ?? true ) {
    sampler.translate(
      columns,
      0
    );
    sampler.scale(
      -1,
      1
    );
  }

  sampler.image(
    element,
    ( columns - drawWidth ) / 2,
    ( rows - drawHeight ) / 2,
    drawWidth,
    drawHeight
  );
  sampler.pop();

  sampler.loadPixels();

  return {
    columns,
    rows,
    pixels: sampler.pixels
  };
}

/** Spawn a shockwave ring on each kick, then age the live ones. */
function updateRings(
  audio, reaction
) {
  const p = getP5();

  if ( audio.enabled && audio.kick?.hit && ( reaction.kickRings ?? true ) ) {
    state.rings.push( {
      radius: 0,
      strength: Math.max(
        0.3,
        audio.kick.strength
      )
    } );
  }

  const speed = ( reaction.ringSpeed ?? 0.02 ) * p.width;
  const dt = Math.min(
    p.deltaTime,
    50
  ) / ( 1000 / 60 );

  for ( let i = state.rings.length - 1; i >= 0; i-- ) {
    const ring = state.rings[ i ];

    ring.radius += speed * dt;

    if ( ring.radius > p.width * 1.2 ) {
      state.rings.splice(
        i,
        1
      );
    }
  }
}

/**
 * Draw every grid cell as a dot: color from the sampled pixel (or a duotone
 * ramp on its brightness), size from brightness swollen by bass, position
 * scattered along a stable per-cell noise ray by the current loudness.
 */
function drawCells(
  cells, level, audio, reaction, appearance
) {
  const p = getP5();

  const cellWidth = p.width / cells.columns;
  const cellHeight = p.height / cells.rows;
  const bass = audio.enabled ? audio.bands?.bass ?? 0 : 0;

  const scatterAmplitude = level * ( reaction.scatter ?? 0.25 ) * p.width;
  const pulse = 1 + bass * ( reaction.bassPulse ?? 1.2 );
  const dotScale = ( appearance.dotScale ?? 0.9 ) * pulse;
  const invert = appearance.invertBrightness ?? false;
  const duotone = ( appearance.colorMode ?? "source" ) === "duotone";
  const shadow = appearance.shadow ?? [
    20,
    24,
    60
  ];
  const highlight = appearance.highlight ?? [
    255,
    240,
    220
  ];

  p.push();
  p.noStroke();

  for ( let gy = 0; gy < cells.rows; gy++ ) {
    for ( let gx = 0; gx < cells.columns; gx++ ) {
      const index = ( gy * cells.columns + gx ) * 4;
      const red = cells.pixels[ index ];
      const green = cells.pixels[ index + 1 ];
      const blue = cells.pixels[ index + 2 ];

      let brightness = ( red * 0.299 + green * 0.587 + blue * 0.114 ) / 255;

      if ( invert ) {
        brightness = 1 - brightness;
      }

      if ( brightness < ( appearance.threshold ?? 0.06 ) ) {
        continue;
      }

      // Stable per-cell scatter ray, so a cell flies out and back along the
      // same direction instead of jittering every frame.
      const angle = p.noise(
        gx * 0.21,
        gy * 0.21
      ) * p.TAU * 2;

      const x = ( gx + 0.5 ) * cellWidth + Math.cos( angle ) * scatterAmplitude * brightness;
      const y = ( gy + 0.5 ) * cellHeight + Math.sin( angle ) * scatterAmplitude * brightness;
      const diameter = brightness * Math.min(
        cellWidth,
        cellHeight
      ) * dotScale;

      if ( duotone ) {
        p.fill(
          p.lerp(
            shadow[ 0 ],
            highlight[ 0 ],
            brightness
          ),
          p.lerp(
            shadow[ 1 ],
            highlight[ 1 ],
            brightness
          ),
          p.lerp(
            shadow[ 2 ],
            highlight[ 2 ],
            brightness
          )
        );
      } else {
        p.fill(
          red,
          green,
          blue
        );
      }

      p.circle(
        x,
        y,
        diameter
      );
    }
  }

  p.pop();
}

function drawRings( appearance ) {
  const p = getP5();

  const highlight = appearance.highlight ?? [
    255,
    240,
    220
  ];

  p.push();
  p.noFill();

  for ( const ring of state.rings ) {
    const fade = Math.max(
      0,
      1 - ring.radius / ( p.width * 1.2 )
    );

    p.stroke(
      highlight[ 0 ],
      highlight[ 1 ],
      highlight[ 2 ],
      fade * ring.strength * 160
    );
    p.strokeWeight( 2 + ring.strength * 6 );
    p.circle(
      p.width / 2,
      p.height / 2,
      ring.radius * 2
    );
  }

  p.pop();
}

function drawCaption(
  caption, background
) {
  const p = getP5();

  string.write(
    caption,
    0,
    p.height * 0.92,
    {
      size: 32,
      strokeWeight: 0,
      stroke: p.color( ...background ),
      fill: p.color( ...background ),
      font: string.fonts.loraItalic,
      textAlign: [
        p.CENTER,
        p.CENTER
      ],
      blendMode: p.EXCLUSION
    }
  );
}

function drawHint(
  hint, background
) {
  const p = getP5();

  string.write(
    hint,
    0,
    p.height / 2,
    {
      size: 24,
      strokeWeight: 0,
      stroke: p.color( ...background ),
      fill: p.color( ...background ),
      font: string.fonts.loraItalic,
      textAlign: [
        p.CENTER,
        p.CENTER
      ],
      blendMode: p.EXCLUSION
    }
  );
}
