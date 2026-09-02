import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import audio from "@/p5/utils/audio.js";
import events from "@/p5/utils/events.js";
import animation from "@/p5/utils/animation.js";
import {
  generateWavetable,
  parseWavetable,
  sampleWavetable,
  renderNotePcm,
  downloadWavetable,
  createSeededRandom
} from "@/p5/shared/wavetable.js";
import auroraPad from "@/p5/shared/wavetables/aurora-pad.json";

/**
 * WAVETABLE — an Ableton Wavetable-style synth voice as a sketch.
 *
 * The table (a stack of single-cycle frames) is drawn as a receding 3D-ish
 * stack, with the currently sounding morph position rendered as one bright
 * interpolated curve travelling through it — plus a morph track on the right
 * and a step lane below, so the visual is the instrument's own UI.
 *
 * Sound: a seeded step pattern walks a scale; every step is baked to PCM with
 * `renderNotePcm` (pure math, no audio graph) and registered as a named sample
 * in utils/audio.js. `audio.trigger()` then plays it live AND replays it
 * bit-identically in the deterministic offline render, so the recording's
 * audio matches the preview exactly.
 *
 * Portability (the whole point of the .json): press **E** to download the
 * current table as a `p5t-wavetable` .json — frames plus the generating spec.
 * Any other sketch reloads it via `parseWavetable()` (paste it into the
 * "Custom wavetable .json" textarea, or commit it under
 * `src/templates/p5/shared/wavetables/` and import it, like the bundled
 * aurora-pad preset selectable in the I/O panel).
 *
 * Dragging on the display scrubs the morph position visually; the audible
 * notes keep their baked morph so playback stays deterministic.
 */

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B"
];

const SCALES = {
  minorPentatonic: [
    0,
    3,
    5,
    7,
    10
  ],
  majorPentatonic: [
    0,
    2,
    4,
    7,
    9
  ],
  major: [
    0,
    2,
    4,
    5,
    7,
    9,
    11
  ],
  naturalMinor: [
    0,
    2,
    3,
    5,
    7,
    8,
    10
  ],
  dorian: [
    0,
    2,
    3,
    5,
    7,
    9,
    10
  ],
  wholeTone: [
    0,
    2,
    4,
    6,
    8,
    10
  ],
  chromatic: [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11
  ]
};

const state = sketch.state( () => ( {
  configKey: null,
  table: null,
  steps: [],
  lastStep: null,
  flashAt: -1,
  unregisterKeyTyped: null
} ) );

function midiToFreq( midi ) {
  return 440 * Math.pow(
    2,
    ( midi - 69 ) / 12
  );
}

function midiToLabel( midi ) {
  return NOTE_NAMES[ midi % 12 ] + String( Math.floor( midi / 12 ) - 1 );
}

/** "A2" → midi 45. Falls back to A2 on anything unparsable. */
function parseRootMidi( root ) {
  const match = /^([A-G]#?)(-?\d)$/.exec( root ?? "" );

  if ( !match ) {
    return 45;
  }

  return 12 * ( Number( match[ 2 ] ) + 1 ) + NOTE_NAMES.indexOf( match[ 1 ] );
}

/**
 * Build the step pattern: expand root+scale over the octave range into a note
 * pool, then walk it. "random" walks are seeded, so every loop (and every
 * recording) plays the identical melody.
 */
function buildSteps(
  notes, seed
) {
  const rootMidi = parseRootMidi( notes.root );
  const intervals = SCALES[ notes.scale ] ?? SCALES.minorPentatonic;
  const octaves = Math.max(
    1,
    Math.round( notes.octaves ?? 2 )
  );
  const pool = [];

  for ( let octave = 0; octave < octaves; octave++ ) {
    for ( const interval of intervals ) {
      pool.push( rootMidi + interval + 12 * octave );
    }
  }

  pool.push( rootMidi + 12 * octaves );

  const count = Math.max(
    2,
    Math.round( notes.steps ?? 16 )
  );
  const rng = createSeededRandom( seed );
  const steps = [];

  for ( let i = 0; i < count; i++ ) {
    let index;

    switch ( notes.pattern ) {
      case "down":
        index = pool.length - 1 - ( i % pool.length );
        break;
      case "upDown": {
        const period = Math.max(
          1,
          2 * pool.length - 2
        );
        const j = i % period;

        index = j < pool.length ? j : period - j;
        break;
      }
      case "thirds":
        index = ( i * 2 ) % pool.length;
        break;
      case "random":
        index = Math.floor( rng() * pool.length );
        break;
      case "up":
      default:
        index = i % pool.length;
        break;
    }

    const midi = pool[ index ];

    steps.push( {
      midi,
      freq: midiToFreq( midi ),
      label: midiToLabel( midi )
    } );
  }

  return steps;
}

/** Morph position for a loop progression in [0,1], per the morph options. */
function morphAt(
  progression, morphOptions
) {
  const start = morphOptions.start ?? 0;
  const end = morphOptions.end ?? 1;
  const clamped = Math.min(
    1,
    Math.max(
      0,
      progression
    )
  );
  let x;

  switch ( morphOptions.mode ) {
    case "static":
      x = 0;
      break;
    case "pingPong":
      x = clamped < 0.5 ? clamped * 2 : 2 - clamped * 2;
      break;
    case "sweep":
    default:
      x = clamped;
      break;
  }

  return start + ( end - start ) * x;
}

/**
 * Table source priority: custom .json (uploaded or pasted) → bundled preset →
 * generator spec. A broken payload falls back to the generator instead of
 * blanking the sketch.
 *
 * The `json` field stores parsed JSON once valid, or the raw string while the
 * user is mid-edit, so accept both — `parseWavetable` already does.
 */
function resolveTable( o ) {
  const io = o.io ?? {};
  const customJson = io.customJson;
  const hasCustom = typeof customJson === "string"
    ? customJson.trim().length > 0
    : customJson != null && typeof customJson === "object";

  if ( hasCustom ) {
    try {
      return parseWavetable( customJson );
    } catch {
      // Invalid payload — fall through to the configured source.
    }
  }

  if ( io.source === "preset" ) {
    return parseWavetable( auroraPad );
  }

  return generateWavetable( o.wavetable ?? {} );
}

/**
 * Rebuild the table and bake one PCM buffer per step. Buffers are registered
 * as named samples in utils/audio.js, which is what makes them survive the
 * deterministic capture path: trigger events get logged with the name, and
 * the offline render replays the very same buffers.
 */
function rebuild(
  o, duration
) {
  const table = resolveTable( o );
  const seed = o.wavetable?.seed ?? 1;
  const steps = buildSteps(
    o.notes ?? {},
    seed
  );
  const audioOptions = o.audio ?? {};
  const morphOptions = o.morph ?? {};
  const gate = Math.min(
    1,
    Math.max(
      0.05,
      o.notes?.gate ?? 0.65
    )
  );
  const stepDuration = duration / steps.length;
  const release = audioOptions.release ?? 0.12;
  const sampleRate = 48000;

  if ( typeof AudioBuffer !== "undefined" ) {
    steps.forEach( (
      step, i
    ) => {
      const pcm = renderNotePcm(
        table,
        {
          freq: step.freq,
          duration: stepDuration * gate + release,
          sampleRate,
          morphFrom: morphAt(
            i / steps.length,
            morphOptions
          ),
          morphTo: morphAt(
            ( i + gate ) / steps.length,
            morphOptions
          ),
          attack: audioOptions.attack ?? 0.01,
          release,
          gain: 0.5,
          drive: audioOptions.drive ?? 0
        }
      );
      const buffer = new AudioBuffer( {
        numberOfChannels: 1,
        length: pcm.length,
        sampleRate
      } );

      buffer.copyToChannel(
        pcm,
        0
      );
      audio.registerSample(
        `wavetable-step-${ i }`,
        buffer
      );
    } );
  }

  state.table = table;
  state.steps = steps;
}

sketch.setup( () => {
  state.configKey = null;
  state.table = null;
  state.steps = [];
  state.lastStep = null;
  state.flashAt = -1;

  state.unregisterKeyTyped?.();
  state.unregisterKeyTyped = events.register(
    "engine-on-key-typed",
    () => {
      const key = getP5()?.key?.toLowerCase?.();

      if ( key === "e" && state.table ) {
        downloadWavetable( state.table );
      }
    }
  );
} );

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};
  const look = o.look ?? {};
  const audioOptions = o.audio ?? {};
  const duration = sketch.sketchOptions?.animation?.duration ?? 12;

  // Rebuild table + baked note buffers only when the sound-relevant options
  // actually change — cheap enough to do synchronously on the frame.
  const configKey = JSON.stringify( [
    o.wavetable,
    o.notes,
    o.audio,
    o.morph,
    o.io,
    duration
  ] );

  if ( configKey !== state.configKey ) {
    state.configKey = configKey;
    state.lastStep = null;
    rebuild(
      o,
      duration
    );
  }

  const table = state.table;
  const steps = state.steps;
  const progression = animation.progression;

  // ── Sequencer: edge-trigger the baked buffer of the step we just entered ──
  const stepIndex = Math.min(
    steps.length - 1,
    Math.floor( progression * steps.length )
  );

  if ( stepIndex !== state.lastStep ) {
    if ( audioOptions.enabled !== false ) {
      audio.trigger(
        `wavetable-step-${ stepIndex }`,
        {
          gain: audioOptions.volume ?? 0.8
        }
      );
    }

    state.flashAt = time;
  }

  state.lastStep = stepIndex;

  // ── Layout ────────────────────────────────────────────────────────────────
  const w = p.width;
  const h = p.height;
  const x0 = w * 0.10;
  const x1 = w * 0.84;
  const yFront = h * 0.60;
  const yBack = h * 0.20;
  const skew = w * 0.05 * ( look.perspective ?? 1 );
  const amp = h * 0.05;
  const wave = look.wave ?? [
    130,
    255,
    190
  ];
  const dim = look.dim ?? [
    90,
    110,
    130
  ];

  let morph = morphAt(
    progression,
    o.morph ?? {}
  );

  // Drag on the display to scrub the morph position (visual only — the
  // audible notes keep their baked morph so playback stays deterministic).
  if ( p.mouseIsPressed && p.mouseX >= 0 && p.mouseX <= w && p.mouseY >= 0 && p.mouseY <= h ) {
    morph = p.constrain(
      p.map(
        p.mouseY,
        yFront,
        yBack,
        0,
        1
      ),
      0,
      1
    );
  }

  const flash = Math.exp( -Math.max(
    0,
    time - state.flashAt
  ) * 5 );

  p.clear();
  p.background( ...( look.background ?? [
    8,
    10,
    14
  ] ) );

  if ( !table ) {
    return;
  }

  // ── Wavetable stack, back to front ────────────────────────────────────────
  const frameCount = table.frames.length;
  const resolution = 128;

  p.push();
  p.noFill();
  p.strokeWeight( Math.max(
    1,
    w * 0.0012
  ) );

  for ( let fi = frameCount - 1; fi >= 0; fi-- ) {
    const t = frameCount > 1 ? fi / ( frameCount - 1 ) : 0;
    const baseY = p.lerp(
      yFront,
      yBack,
      t
    );
    const offsetX = skew * t;

    p.stroke(
      dim[ 0 ],
      dim[ 1 ],
      dim[ 2 ],
      p.lerp(
        160,
        60,
        t
      )
    );
    p.beginShape();

    for ( let k = 0; k <= resolution; k++ ) {
      const phase = k / resolution;

      p.vertex(
        p.lerp(
          x0,
          x1,
          phase
        ) + offsetX,
        baseY - table.frames[ fi ][ Math.floor( phase * ( table.frameSize - 1 ) ) ] * amp
      );
    }

    p.endShape();
  }

  // The interpolated curve at the current morph position — the sounding wave.
  const morphY = p.lerp(
    yFront,
    yBack,
    morph
  );
  const morphX = skew * morph;
  const drawMorphCurve = (
    weight, alpha
  ) => {
    p.strokeWeight( weight );
    p.stroke(
      wave[ 0 ],
      wave[ 1 ],
      wave[ 2 ],
      alpha
    );
    p.beginShape();

    for ( let k = 0; k <= resolution * 2; k++ ) {
      const phase = k / ( resolution * 2 );

      p.vertex(
        p.lerp(
          x0,
          x1,
          phase
        ) + morphX,
        morphY - sampleWavetable(
          table,
          morph,
          phase
        ) * amp
      );
    }

    p.endShape();
  };

  drawMorphCurve(
    w * 0.008,
    40 + 90 * flash
  );
  drawMorphCurve(
    Math.max(
      1.5,
      w * 0.0022
    ),
    255
  );
  p.pop();

  // ── Morph track (right edge): where the bright curve sits in the stack ────
  const trackX = x1 + skew + w * 0.045;

  p.push();
  p.stroke(
    dim[ 0 ],
    dim[ 1 ],
    dim[ 2 ],
    140
  );
  p.strokeWeight( Math.max(
    1,
    w * 0.0012
  ) );
  p.line(
    trackX,
    yBack,
    trackX,
    yFront
  );
  p.noStroke();
  p.fill(
    wave[ 0 ],
    wave[ 1 ],
    wave[ 2 ],
    255
  );
  p.circle(
    trackX,
    p.lerp(
      yFront,
      yBack,
      morph
    ),
    w * 0.012 + w * 0.006 * flash
  );
  p.pop();

  // ── Step lane ─────────────────────────────────────────────────────────────
  if ( look.showSequencer !== false && steps.length > 0 ) {
    const laneY = h * 0.68;
    const laneH = h * 0.030;
    const gap = w * 0.0025;
    const cellW = ( x1 - x0 ) / steps.length;

    p.push();

    for ( let i = 0; i < steps.length; i++ ) {
      const cellX = x0 + i * cellW;

      if ( i === stepIndex ) {
        p.noStroke();
        p.fill(
          wave[ 0 ],
          wave[ 1 ],
          wave[ 2 ],
          140 + 115 * flash
        );
      } else {
        p.noFill();
        p.stroke(
          dim[ 0 ],
          dim[ 1 ],
          dim[ 2 ],
          110
        );
        p.strokeWeight( 1 );
      }

      p.rect(
        cellX + gap,
        laneY,
        cellW - gap * 2,
        laneH
      );
    }

    p.pop();
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  if ( look.showHud !== false ) {
    const margin = w * 0.10;
    const big = w * 0.036;
    const small = w * 0.019;
    const mode = ( table.spec?.mode ?? "imported" ).toUpperCase();
    const step = steps[ stepIndex ];

    p.push();
    p.noStroke();
    p.fill(
      wave[ 0 ],
      wave[ 1 ],
      wave[ 2 ]
    );
    p.textFont( "monospace" );
    p.textAlign(
      p.LEFT,
      p.BASELINE
    );

    p.textSize( big );
    p.text(
      "WAVETABLE",
      margin,
      h * 0.085
    );

    p.textSize( small );
    p.fill(
      dim[ 0 ],
      dim[ 1 ],
      dim[ 2 ]
    );
    p.text(
      `${ table.name.toUpperCase() } · ${ mode } · ${ frameCount }×${ table.frameSize }`,
      margin,
      h * 0.085 + small * 1.8
    );

    const rows = [
      `MORPH ${ String( Math.round( morph * 100 ) ).padStart(
        3,
        "0"
      ) }% · STEP ${ String( stepIndex + 1 ).padStart(
        2,
        "0"
      ) }/${ steps.length }${ step ? ` · ${ step.label } ${ step.freq.toFixed( 1 ) }HZ` : "" }`,
      `SEED ${ o.wavetable?.seed ?? 1 } · LOOP ${ duration }S · DRAG = SCRUB · E = EXPORT .JSON`
    ];

    rows.forEach( (
      row, i
    ) => {
      p.text(
        row,
        margin,
        h * ( 0.80 + i * 0.028 )
      );
    } );

    p.pop();
  }
} );
