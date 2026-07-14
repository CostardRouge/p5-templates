import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import audio from "@/p5/utils/audio.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";

// ─────────────────────────────────────────────────────────────────────────────
// ascii-pulse v1 — komputery.
//
// A love letter to Ksawery Komputery's aesthetic: a monospace glyph grid on
// black, bold flat colours, and a whole field that THROBS to a beat. A radial
// wave drifts through a lattice of characters; on every beat an expanding
// coloured ring punches out from the centre and the grid thumps brighter — and
// the SAME beat fires a chunky synth note, so the picture scores itself.
//
// Everything is a pure function of the loop phase φ = animation.progression, and
// every animated term is an integer number of cycles per loop, so the visual is
// a seamless loop. The beat ring's envelope is sin(π·beatFrac), which is zero at
// every beat boundary (and therefore at the loop seam), so the pulse never
// jumps. Audio rides the same beat clock through the shared code-driven engine
// (audio.trigger), which the deterministic recorder renders offline — so the
// exported video's soundtrack is sample-locked to the frames with no mic.
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

// Bold, flat, primary-leaning palettes — the Komputery colour language.
const PALETTES = {
  komputery: [
    [
      255,
      59,
      48
    ],
    [
      255,
      204,
      0
    ],
    [
      0,
      122,
      255
    ],
    [
      52,
      199,
      89
    ],
    [
      175,
      82,
      222
    ]
  ],
  crt: [
    [
      0,
      255,
      140
    ],
    [
      0,
      200,
      255
    ],
    [
      245,
      245,
      245
    ]
  ],
  hot: [
    [
      255,
      45,
      85
    ],
    [
      255,
      149,
      0
    ],
    [
      255,
      214,
      10
    ]
  ]
};

// A short bass motif (scale degrees) the beat walks through — gives the pulse a
// tune instead of a monotone thud.
const BASS_PATTERN = [
  0,
  0,
  7,
  0,
  5,
  0,
  7,
  3
];

const state = {
  lastBeat: -1
};

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();

  const o = options.sketch ?? {};
  const grid = o.grid ?? {};
  const wave = o.wave ?? {};
  const beat = o.beat ?? {};
  const audioOpts = o.audio ?? {};
  const colors = o.colors ?? {};

  const background = colors.backgroundColor ?? [
    8,
    8,
    10
  ];

  p.clear();
  p.background( ...background );

  const field = resolveField(
    p,
    grid,
    wave,
    beat
  );

  playBeat(
    field,
    audioOpts
  );

  drawGrid(
    p,
    field,
    grid,
    colors
  );
} );

// Resolve everything the frame needs: grid dimensions, the wave parameters, and
// the current beat / its envelope. Kept in one place so the renderer and the
// audio read a single consistent snapshot.
function resolveField(
  p, grid, wave, beat
) {
  const columns = Math.max(
    4,
    Math.round( grid.columns ?? 22 )
  );
  const rows = Math.max(
    4,
    Math.round( columns * p.height / p.width )
  );

  const beatsPerLoop = Math.max(
    1,
    Math.round( beat.beatsPerLoop ?? 8 )
  );
  const phase = animation.progression;
  const playhead = phase * beatsPerLoop;
  const beatIndex = Math.floor( playhead ) % beatsPerLoop;
  const beatFrac = playhead - Math.floor( playhead );
  // Zero at both ends of every beat → continuous across beats AND the loop seam.
  const env = Math.sin( beatFrac * Math.PI );

  return {
    columns,
    rows,
    cellW: p.width / columns,
    cellH: p.height / rows,
    phase,
    beatsPerLoop,
    beatIndex,
    beatFrac,
    env,
    rippleRadius: beatFrac * ( beat.reach ?? 0.95 ),
    ringWidth: beat.ringWidth ?? 0.12,
    pulseStrength: beat.pulseStrength ?? 1.1,
    thump: beat.thump ?? 0.25,
    waveCycles: Math.round( wave.waveCycles ?? 3 ),
    radialFreq: wave.radialFreq ?? 5,
    arms: Math.round( wave.arms ?? 3 ),
    baseWeight: wave.baseWeight ?? 0.75,
    contrast: wave.contrast ?? 1.4
  };
}

// Intensity 0..1 at a cell centre (px, py). Base radial+arm wave, plus the
// expanding beat ring, plus a whole-grid thump — all periodic in φ.
function cellIntensity(
  field, px, py, minDim, cx, cy
) {
  const nx = ( px - cx ) / minDim;
  const ny = ( py - cy ) / minDim;
  const r = Math.hypot(
    nx,
    ny
  );
  const angle = Math.atan2(
    ny,
    nx
  );

  const base = 0.5 + 0.5 * Math.sin( TAU * ( field.waveCycles * field.phase - r * field.radialFreq ) + field.arms * angle );

  const ringDelta = ( r - field.rippleRadius ) / field.ringWidth;
  const ring = field.env * Math.exp( -ringDelta * ringDelta );

  let intensity = field.baseWeight * base +
    field.pulseStrength * ring +
    field.thump * field.env;

  // Contrast around the mid pivot, then clamp.
  intensity = 0.5 + ( intensity - 0.5 ) * field.contrast;

  return {
    intensity: Math.max(
      0,
      Math.min(
        1,
        intensity
      )
    ),
    ring
  };
}

// Fire one synth note when the beat advances. Runs off the same beat index the
// visuals use, so sound and the ring punch land on the same frame.
function playBeat(
  field, audioOpts
) {
  if ( !( audioOpts.enabled ?? true ) ) {
    return;
  }

  if ( field.beatIndex === state.lastBeat ) {
    return;
  }

  state.lastBeat = field.beatIndex;

  const rootMidi = audioOpts.rootMidi ?? 36;
  const degree = BASS_PATTERN[ field.beatIndex % BASS_PATTERN.length ];
  const bassFreq = 440 * Math.pow(
    2,
    ( rootMidi + degree - 69 ) / 12
  );
  const volume = audioOpts.volume ?? 0.5;

  audio.trigger(
    "beep",
    {
      freq: bassFreq,
      type: audioOpts.waveform ?? "square",
      duration: audioOpts.noteLength ?? 0.16,
      gain: volume
    }
  );

  // A high blip an octave-and-a-fifth up on the off-beats for rhythmic sparkle.
  if ( ( audioOpts.blip ?? true ) && field.beatIndex % 2 === 1 ) {
    audio.trigger(
      "beep",
      {
        freq: bassFreq * 3,
        type: "sine",
        duration: 0.05,
        gain: volume * 0.4
      }
    );
  }
}

function drawGrid(
  p, field, grid, colors
) {
  const font = string.fonts?.[ grid.font ] ?? string.fonts.spaceMonoRegular;
  const ramp = ( grid.ramp && grid.ramp.length > 0 ) ? grid.ramp : " .:-=+*#%@";
  const palette = PALETTES[ colors.palette ] ?? PALETTES.komputery;
  const baseColor = colors.baseColor ?? [
    90,
    100,
    120
  ];
  const beatColor = palette[ field.beatIndex % palette.length ];
  const spectrum = ( colors.colorMode ?? "pulse" ) === "spectrum";
  const ringColorBoost = colors.ringColorBoost ?? 2.2;
  const glyphScale = grid.glyphScale ?? 1.15;

  const minDim = Math.min(
    p.width,
    p.height
  );
  const cx = p.width / 2;
  const cy = p.height / 2;
  const rampMax = ramp.length - 1;

  p.push();

  if ( font?.font ) {
    p.textFont( font );
  }

  p.textAlign(
    p.CENTER,
    p.CENTER
  );
  p.textSize( Math.min(
    field.cellW,
    field.cellH
  ) * glyphScale );
  p.noStroke();

  for ( let row = 0; row < field.rows; row++ ) {
    const py = ( row + 0.5 ) * field.cellH;

    for ( let col = 0; col < field.columns; col++ ) {
      const px = ( col + 0.5 ) * field.cellW;
      const {
        intensity, ring
      } = cellIntensity(
        field,
        px,
        py,
        minDim,
        cx,
        cy
      );

      if ( intensity <= 0.02 ) {
        continue;
      }

      const glyph = ramp.charAt( Math.round( intensity * rampMax ) );

      if ( glyph === " " ) {
        continue;
      }

      const brightness = 0.35 + 0.65 * intensity;

      let r;
      let g;
      let b;

      if ( spectrum ) {
        // Concentric colour bands that rotate one step per beat.
        const bandIndex = ( Math.floor( intensity * palette.length ) + field.beatIndex ) % palette.length;
        const band = palette[ bandIndex ];

        r = band[ 0 ] * brightness;
        g = band[ 1 ] * brightness;
        b = band[ 2 ] * brightness;
      } else {
        // Mono field in baseColor, with the expanding ring painted in the beat's
        // accent colour as it sweeps through.
        const mix = Math.min(
          1,
          ring * ringColorBoost
        );

        r = ( baseColor[ 0 ] + ( beatColor[ 0 ] - baseColor[ 0 ] ) * mix ) * brightness;
        g = ( baseColor[ 1 ] + ( beatColor[ 1 ] - baseColor[ 1 ] ) * mix ) * brightness;
        b = ( baseColor[ 2 ] + ( beatColor[ 2 ] - baseColor[ 2 ] ) * mix ) * brightness;
      }

      p.fill(
        r,
        g,
        b
      );
      p.text(
        glyph,
        px,
        py
      );
    }
  }

  p.pop();
}
