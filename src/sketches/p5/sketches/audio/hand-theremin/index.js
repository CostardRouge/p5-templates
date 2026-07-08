import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import time from "@/p5/utils/time.js";
import audio from "@/p5/utils/audio.js";
import string from "@/p5/utils/string.js";
import neonDot from "@/p5/utils/visuals/neonDot.js";
import {
  getInteractionMetrics,
  getPointers,
  initInteraction
} from "@/p5/utils/interaction/index.js";

// ── hand-theremin ──────────────────────────────────────────────────────────
// Conduct music with a bare hand. The tracked palm is the playhead of a step
// sequencer; the gesture snapshot shapes every note the sketch synthesises:
//
//   hand height   → pitch (quantised to the chosen scale — never a bum note)
//   hand openness → volume (open hand sings, closing it fades out)
//   finger spread → timbre (sine → triangle → square → sawtooth brightness)
//   pinch         → octave jump (+1 octave while pinched)
//
// Sound comes from the shared code-driven audio engine (`audio.trigger`), so
// notes play live AND are logged for the deterministic offline render — the
// exported video's soundtrack matches the visuals sample-accurately with no
// microphone involved. Faint horizontal lanes mark every scale degree, each
// note ripples out from the hand, and the mouse plays too (default on) so the
// instrument works without a camera.

const WAVEFORMS = [
  "sine",
  "triangle",
  "square",
  "sawtooth"
];

const SCALES = {
  pentatonic: [
    0,
    3,
    5,
    7,
    10
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
  minor: [
    0,
    2,
    3,
    5,
    7,
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

const state = {
  lastStep: -1,
  ripples: []
};

sketch.setup( async() => {
  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();

  const interaction = options.sketch?.interaction ?? {};
  const instrument = options.sketch?.instrument ?? {};
  const visuals = options.sketch?.visuals ?? {};
  const overlay = options.sketch?.overlay ?? {};
  const background = options.sketch?.backgroundColor ?? [
    8,
    8,
    14
  ];

  p.clear();
  p.background( ...background );

  const pointers = getPointers( interaction );
  const performance_ = readPerformance(
    interaction,
    instrument,
    pointers
  );

  drawLanes(
    instrument,
    visuals
  );

  if ( performance_ ) {
    playStep(
      performance_,
      instrument,
      visuals
    );
  }

  updateRipples( visuals );
  drawRipples();

  if ( performance_ && ( visuals.showHand ?? true ) ) {
    neonDot( {
      sizeRange: [
        visuals.handSize ?? 60,
        ( visuals.handSize ?? 60 ) / 3
      ],
      shadowsCount: visuals.handGlow ?? 3,
      position: performance_.position,
      index: performance_.position.x / p.width
    } );
  }

  if ( overlay.show ?? true ) {
    drawCaption(
      overlay.caption ?? "🔊 conducted by hand · no instrument touched",
      background
    );
  }
} );

/**
 * The live performance: where the conducting hand is and how it is shaping the
 * note. A tracked hand plays with its full gesture snapshot; without one, the
 * first pointer (mouse / touch / orbit) performs with neutral gesture values
 * so the instrument previews camera-less.
 */
function readPerformance(
  interaction, instrument, pointers
) {
  const metrics = getInteractionMetrics( interaction );
  const hand = metrics.hand;

  if ( hand.present > 0.5 && pointers.length > 0 ) {
    return {
      position: pointers[ 0 ],
      openness: hand.openness,
      spread: hand.spread,
      pinched: hand.pinch >= ( instrument.pinchThreshold ?? 0.55 )
    };
  }

  if ( ( instrument.mousePlays ?? true ) && pointers.length > 0 ) {
    return {
      position: pointers[ 0 ],
      openness: 0.75,
      spread: 0,
      pinched: false
    };
  }

  return null;
}

/** Scale degrees available across the configured octave range. */
function degreeCount( instrument ) {
  const intervals = SCALES[ instrument.scale ] ?? SCALES.pentatonic;

  return intervals.length * ( instrument.octaves ?? 2 ) + 1;
}

/** Frequency (Hz) of the given scale degree above the root note. */
function degreeToFrequency(
  degree, instrument
) {
  const intervals = SCALES[ instrument.scale ] ?? SCALES.pentatonic;
  const octave = Math.floor( degree / intervals.length );
  const semitone = ( instrument.rootMidi ?? 45 ) +
    octave * 12 +
    intervals[ degree % intervals.length ];

  return 440 * Math.pow(
    2,
    ( semitone - 69 ) / 12
  );
}

/**
 * The step-sequencer heart: once per step (driven by the deterministic sketch
 * clock, so live play and offline renders agree), synthesise one note shaped
 * by the current gesture and spawn its ripple.
 */
function playStep(
  performance_, instrument, visuals
) {
  const p = getP5();
  const rate = instrument.notesPerSecond ?? 6;
  const step = Math.floor( time.seconds() * rate );

  if ( step === state.lastStep ) {
    return;
  }

  state.lastStep = step;

  const gain = ( instrument.volume ?? 0.5 ) * Math.max(
    0.05,
    performance_.openness
  );

  if ( gain <= 0.01 ) {
    return;
  }

  const degrees = degreeCount( instrument );
  const yNorm = 1 - Math.min(
    Math.max(
      performance_.position.y / p.height,
      0
    ),
    1
  );
  const degree = Math.min(
    degrees - 1,
    Math.floor( yNorm * degrees )
  );

  let frequency = degreeToFrequency(
    degree,
    instrument
  );

  if ( performance_.pinched ) {
    frequency *= 2;
  }

  const waveform = WAVEFORMS[ Math.min(
    WAVEFORMS.length - 1,
    Math.floor( performance_.spread * WAVEFORMS.length )
  ) ];

  audio.trigger(
    "beep",
    {
      freq: frequency,
      type: waveform,
      duration: instrument.noteLength ?? 0.22,
      gain
    }
  );

  state.ripples.push( {
    x: performance_.position.x,
    y: performance_.position.y,
    radius: 10,
    strength: gain,
    hue: ( performance_.position.x / p.width ) * 300 +
      ( performance_.pinched ? 40 : 0 ),
    maxRadius: ( visuals.rippleSize ?? 0.3 ) * p.width
  } );
}

function updateRipples( visuals ) {
  const p = getP5();
  const dt = Math.min(
    p.deltaTime,
    50
  ) / ( 1000 / 60 );
  const speed = ( visuals.rippleSpeed ?? 0.012 ) * p.width;

  for ( let i = state.ripples.length - 1; i >= 0; i-- ) {
    const ripple = state.ripples[ i ];

    ripple.radius += speed * dt;

    if ( ripple.radius > ripple.maxRadius ) {
      state.ripples.splice(
        i,
        1
      );
    }
  }
}

function drawRipples() {
  const p = getP5();

  p.push();
  p.noFill();
  p.colorMode(
    p.HSB,
    360,
    100,
    100,
    1
  );

  for ( const ripple of state.ripples ) {
    const life = 1 - ripple.radius / ripple.maxRadius;

    p.stroke(
      ripple.hue % 360,
      70,
      100,
      life * ripple.strength
    );
    p.strokeWeight( 2 + life * 8 );
    p.circle(
      ripple.x,
      ripple.y,
      ripple.radius * 2
    );
  }

  p.pop();
}

/** Faint horizontal lanes — one per playable scale degree, the "fretboard". */
function drawLanes(
  instrument, visuals
) {
  if ( !( visuals.showLanes ?? true ) ) {
    return;
  }

  const p = getP5();
  const degrees = degreeCount( instrument );
  const intervals = SCALES[ instrument.scale ] ?? SCALES.pentatonic;

  p.push();

  for ( let degree = 0; degree < degrees; degree++ ) {
    const y = p.height - ( ( degree + 0.5 ) / degrees ) * p.height;
    const isRoot = degree % intervals.length === 0;

    p.stroke(
      255,
      isRoot ? 60 : 24
    );
    p.strokeWeight( isRoot ? 2 : 1 );
    p.line(
      0,
      y,
      p.width,
      y
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
