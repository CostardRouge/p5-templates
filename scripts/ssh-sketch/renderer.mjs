// ─────────────────────────────────────────────────────────────────────────────
// ssh-sketch renderer — a native terminal port of ascii-pulse-v1-komputery.
//
// The sketch's visual core (`cellIntensity` + the glyph/colour mapping in
// `drawGrid`) is a pure function of the loop phase φ, so it ports 1:1 from the
// p5 canvas to a terminal cell grid: one character cell = one glyph cell. The
// only geometric twist is that terminal cells are ~twice as tall as they are
// wide, so the field is sampled on a virtual pixel grid where a cell is 1×2 —
// keeping the radial wave circular instead of egg-shaped.
//
// Zero dependencies: emits raw ANSI (truecolor SGR + cursor addressing). The
// same `frame()` feeds both the local TTY runner and the SSH server.
//
// Source of truth for the maths: the sketch at
// src/sketches/p5/sketches/ascii-pulse/ascii-pulse-v1-komputery/index.js and
// its defaults in options.ts — keep them in sync if the sketch evolves.
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

// Mirrors DURATION_DEFAULT (src/lib/animationConfig.ts): one loop = 12 s.
export const LOOP_SECONDS = 12;

// Terminal cells are roughly twice as tall as wide; sample the field on a
// virtual pixel grid of 1×2 per cell so radial geometry stays circular.
const CELL_ASPECT = 2;

// Same bold flat palettes as the sketch.
export const PALETTES = {
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

// Defaults mirrored from the sketch's options.ts formValues.
export const DEFAULTS = {
  ramp: " .:-=+*#%@",
  waveCycles: 3,
  radialFreq: 5,
  arms: 3,
  baseWeight: 0.75,
  contrast: 1.4,
  beatsPerLoop: 8,
  reach: 0.95,
  ringWidth: 0.12,
  pulseStrength: 1.1,
  thump: 0.25,
  palette: "komputery",
  colorMode: "pulse",
  baseColor: [
    90,
    100,
    120
  ],
  ringColorBoost: 2.2,
  backgroundColor: [
    8,
    8,
    10
  ]
};

// Straight port of the sketch's cellIntensity(): base radial+arm wave, plus the
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

// Beat clock, identical to the sketch's resolveField(): playhead in beats, and
// a sin(π·beatFrac) envelope that is zero at every beat boundary.
export function resolveBeat(
  phase, beatsPerLoop
) {
  const playhead = phase * beatsPerLoop;
  const beatIndex = Math.floor( playhead ) % beatsPerLoop;
  const beatFrac = playhead - Math.floor( playhead );

  return {
    beatIndex,
    beatFrac,
    env: Math.sin( beatFrac * Math.PI )
  };
}

export function createRenderer( overrides = {} ) {
  const o = {
    ...DEFAULTS,
    ...overrides
  };
  const palette = PALETTES[ o.palette ] ?? PALETTES.komputery;
  const rampMax = o.ramp.length - 1;
  const spectrum = o.colorMode === "spectrum";

  // One frame of ANSI for a cols×rows terminal at loop phase ∈ [0, 1).
  // Starts with cursor-home and repaints every cell, so frames fully replace
  // each other with no clear (flicker-free).
  function frame(
    cols, rows, phase
  ) {
    const beat = resolveBeat(
      phase,
      o.beatsPerLoop
    );
    const field = {
      phase,
      env: beat.env,
      beatIndex: beat.beatIndex,
      rippleRadius: beat.beatFrac * o.reach,
      ringWidth: o.ringWidth,
      pulseStrength: o.pulseStrength,
      thump: o.thump,
      waveCycles: o.waveCycles,
      radialFreq: o.radialFreq,
      arms: o.arms,
      baseWeight: o.baseWeight,
      contrast: o.contrast
    };

    const width = cols;
    const height = rows * CELL_ASPECT;
    const minDim = Math.min(
      width,
      height
    );
    const cx = width / 2;
    const cy = height / 2;
    const beatColor = palette[ beat.beatIndex % palette.length ];
    const [
      bgR,
      bgG,
      bgB
    ] = o.backgroundColor;

    const lines = [];

    for ( let row = 0; row < rows; row++ ) {
      const py = ( row + 0.5 ) * CELL_ASPECT;

      let line = `\x1b[48;2;${ bgR };${ bgG };${ bgB }m`;
      let lastFg = "";

      for ( let col = 0; col < cols; col++ ) {
        const px = col + 0.5;
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
          line += " ";
          continue;
        }

        const glyph = o.ramp.charAt( Math.round( intensity * rampMax ) );

        if ( glyph === " " ) {
          line += " ";
          continue;
        }

        const brightness = 0.35 + 0.65 * intensity;

        let r;
        let g;
        let b;

        if ( spectrum ) {
          const bandIndex = ( Math.floor( intensity * palette.length ) + beat.beatIndex ) % palette.length;
          const band = palette[ bandIndex ];

          r = band[ 0 ] * brightness;
          g = band[ 1 ] * brightness;
          b = band[ 2 ] * brightness;
        } else {
          const mix = Math.min(
            1,
            ring * o.ringColorBoost
          );

          r = ( o.baseColor[ 0 ] + ( beatColor[ 0 ] - o.baseColor[ 0 ] ) * mix ) * brightness;
          g = ( o.baseColor[ 1 ] + ( beatColor[ 1 ] - o.baseColor[ 1 ] ) * mix ) * brightness;
          b = ( o.baseColor[ 2 ] + ( beatColor[ 2 ] - o.baseColor[ 2 ] ) * mix ) * brightness;
        }

        // Quantize slightly so smooth gradients don't re-emit an SGR per cell.
        const fg = `\x1b[38;2;${ Math.round( r / 4 ) * 4 };${ Math.round( g / 4 ) * 4 };${ Math.round( b / 4 ) * 4 }m`;

        if ( fg !== lastFg ) {
          line += fg;
          lastFg = fg;
        }

        line += glyph;
      }

      lines.push( line );
    }

    return `\x1b[H${ lines.join( "\r\n" ) }\x1b[0m`;
  }

  return {
    frame,
    options: o
  };
}

// Session-scoped terminal bootstrapping / teardown around the frame loop:
// alt screen, hidden cursor, autowrap off (so painting the last column never
// wraps), and the reverse on the way out.
export const ENTER_SCREEN = "\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[2J";
export const LEAVE_SCREEN = "\x1b[0m\x1b[?7h\x1b[?25h\x1b[?1049l";

// Drives frame() against a wall clock at ~fps, calling write( ansi ). Returns
// a stop() that also tells the caller whether a beat advanced (for the bell).
export function startLoop( {
  write,
  getSize,
  overrides = {},
  fps = 30,
  bell = false,
  now = () => Date.now()
} ) {
  const renderer = createRenderer( overrides );
  const beatsPerLoop = renderer.options.beatsPerLoop;

  let lastBeat = -1;

  const timer = setInterval(
    () => {
      const phase = ( now() / 1000 % LOOP_SECONDS ) / LOOP_SECONDS;
      const {
        cols, rows
      } = getSize();

      let out = renderer.frame(
        cols,
        rows,
        phase
      );

      if ( bell ) {
        const beat = resolveBeat(
          phase,
          beatsPerLoop
        );

        if ( beat.beatIndex !== lastBeat ) {
          lastBeat = beat.beatIndex;
          out += "\x07";
        }
      }

      write( out );
    },
    Math.round( 1000 / fps )
  );

  return () => clearInterval( timer );
}
