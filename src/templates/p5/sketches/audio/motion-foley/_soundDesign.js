/**
 * Motion-foley sound library — reusable, code-driven "sound effects" that can
 * be associated to any shape animation.
 *
 * Each entry maps an animation category (appearing, growing, breaking …) to one
 * or more named *variants*. A variant is a pure function
 *
 *     ( duration, tuning ) => [ { at, name, params }, … ]
 *
 * that returns a deterministic *schedule* of sound events:
 *
 *   - `at`     fraction [0..1] of the animation duration at which the event fires
 *   - `name`   a synth preset understood by utils/audio.js ( "beep" | "tick" )
 *   - `params` oscillator / envelope params
 *              ( { type, freq, endFreq, duration, attack, gain } )
 *
 * Returning fractional schedules (instead of playing immediately) is what makes
 * the sounds reusable and stretchable: the consumer multiplies `at` by the real
 * animation length and fires each event when the playhead crosses it. Transient
 * gestures keep a short fixed envelope; sustained gestures (growing, sliding,
 * fading, stretching) derive their envelope length from `duration`, so the audio
 * always starts and ends together with the motion it is glued to.
 *
 * `expandForGroup()` then answers the "one or many items" question: when a
 * category renders several shapes at once, the same schedule is multiplied into
 * a unison, a chord, an arpeggio or a detuned cluster.
 */

const SEMITONE = Math.pow(
  2,
  1 / 12
);

/**
 * Deterministic pseudo-random in [0, 1). Same seed → same value, so a captured
 * recording renders byte-identical audio to the live preview (no Math.random).
 */
function hashRandom( seed ) {
  const x = Math.sin( seed * 12.9898 + 78.233 ) * 43758.5453;

  return x - Math.floor( x );
}

/** Build an oscillator voice event. */
function voice(
  at, params
) {
  return {
    at,
    name: "beep",
    params
  };
}

/** Build a filtered-noise tick event. */
function tick(
  at, params
) {
  return {
    at,
    name: "tick",
    params
  };
}

/** Spread an integer count of events evenly across the [0, 1] timeline. */
function repeat(
  count, make
) {
  const events = [];

  for ( let i = 0; i < count; i++ ) {
    const phase = count > 1 ? i / count : 0;

    events.push( make(
      i,
      phase
    ) );
  }

  return events;
}

const SOUND_LIBRARY = {
  appearing: {
    label: "Appearing",
    base: 660,
    defaultVariant: "pop",
    variants: {
      pop: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "sine",
            freq: o.base * 0.6,
            endFreq: o.base * 1.5,
            duration: Math.min(
              0.22,
              d * 0.6
            ),
            attack: 0.004,
            gain: o.gain
          }
        )
      ],
      swell: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "triangle",
            freq: o.base,
            endFreq: o.base,
            duration: d * 0.8,
            attack: d * 0.4,
            gain: o.gain * 0.9
          }
        )
      ],
      chime: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "sine",
            freq: o.base,
            duration: 0.3,
            attack: 0.005,
            gain: o.gain * 0.8
          }
        ),
        voice(
          0.06,
          {
            type: "sine",
            freq: o.base * 1.5,
            duration: 0.28,
            attack: 0.005,
            gain: o.gain * 0.6
          }
        ),
        voice(
          0.12,
          {
            type: "sine",
            freq: o.base * 2,
            duration: 0.26,
            attack: 0.005,
            gain: o.gain * 0.45
          }
        )
      ]
    }
  },

  growing: {
    label: "Growing",
    base: 330,
    defaultVariant: "riser",
    variants: {
      riser: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "sawtooth",
            freq: o.base,
            endFreq: o.base * 4,
            duration: d * 0.9,
            attack: 0.02,
            gain: o.gain * 0.8
          }
        )
      ],
      steps: (
        d, o
      ) => repeat(
        6,
        (
          i, phase
        ) => voice(
          phase,
          {
            type: "square",
            freq: o.base * Math.pow(
              1.18,
              i
            ),
            duration: Math.min(
              0.12,
              d / 6
            ),
            attack: 0.004,
            gain: o.gain * 0.7
          }
        )
      ),
      bloom: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "triangle",
            freq: o.base,
            endFreq: o.base * 2,
            duration: d * 0.85,
            attack: d * 0.25,
            gain: o.gain * 0.9
          }
        )
      ]
    }
  },

  reducing: {
    label: "Reducing",
    base: 720,
    defaultVariant: "faller",
    variants: {
      faller: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "sawtooth",
            freq: o.base * 2.5,
            endFreq: o.base * 0.6,
            duration: d * 0.9,
            attack: 0.02,
            gain: o.gain * 0.8
          }
        )
      ],
      steps: (
        d, o
      ) => repeat(
        6,
        (
          i, phase
        ) => voice(
          phase,
          {
            type: "square",
            freq: o.base * Math.pow(
              0.84,
              i
            ),
            duration: Math.min(
              0.12,
              d / 6
            ),
            attack: 0.004,
            gain: o.gain * 0.7
          }
        )
      ),
      deflate: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "triangle",
            freq: o.base * 1.5,
            endFreq: o.base * 0.4,
            duration: d * 0.85,
            attack: 0.01,
            gain: o.gain * 0.85
          }
        )
      ]
    }
  },

  shaking: {
    label: "Shaking",
    base: 180,
    defaultVariant: "rattle",
    variants: {
      rattle: (
        d, o
      ) => repeat(
        Math.max(
          5,
          Math.round( d * 20 )
        ),
        (
          i, phase
        ) => {
          const j = hashRandom( i + 1 );

          return tick(
            phase,
            {
              freq: o.base * ( 6 + j * 9 ),
              duration: 0.03,
              gain: o.gain * ( 0.35 + j * 0.4 )
            }
          );
        }
      ),
      buzz: (
        d, o
      ) => repeat(
        Math.max(
          6,
          Math.round( d * 26 )
        ),
        (
          i, phase
        ) => voice(
          phase,
          {
            type: "square",
            freq: o.base * ( i % 2 === 0 ? 1 : 1.06 ),
            duration: 0.04,
            attack: 0.002,
            gain: o.gain * 0.45
          }
        )
      )
    }
  },

  sliding: {
    label: "Sliding",
    base: 480,
    defaultVariant: "whoosh",
    variants: {
      whoosh: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "sine",
            freq: o.base * 0.6,
            endFreq: o.base * 1.8,
            duration: d,
            attack: d * 0.35,
            gain: o.gain * 0.8
          }
        )
      ],
      zip: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "sawtooth",
            freq: o.base * 2.4,
            endFreq: o.base * 0.9,
            duration: Math.min(
              0.3,
              d * 0.8
            ),
            attack: 0.01,
            gain: o.gain * 0.7
          }
        )
      ],
      glide: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "triangle",
            freq: o.base,
            endFreq: o.base * 1.4,
            duration: d * 0.95,
            attack: 0.02,
            gain: o.gain * 0.75
          }
        )
      ]
    }
  },

  fading: {
    label: "Fading in / out",
    base: 520,
    defaultVariant: "breath",
    variants: {
      breath: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "sine",
            freq: o.base,
            endFreq: o.base,
            duration: d,
            attack: d * 0.5,
            gain: o.gain * 0.8
          }
        )
      ],
      pad: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "sine",
            freq: o.base,
            duration: d,
            attack: d * 0.5,
            gain: o.gain * 0.6
          }
        ),
        voice(
          0,
          {
            type: "sine",
            freq: o.base * 1.01,
            duration: d,
            attack: d * 0.5,
            gain: o.gain * 0.45
          }
        )
      ]
    }
  },

  flashing: {
    label: "Flashing",
    base: 1200,
    defaultVariant: "strobe",
    variants: {
      strobe: (
        d, o
      ) => repeat(
        o.flashes ?? 4,
        (
          i, phase
        ) => voice(
          phase,
          {
            type: "square",
            freq: o.base * ( 1 + ( i % 2 ) * 0.5 ),
            duration: 0.045,
            attack: 0.001,
            gain: o.gain
          }
        )
      ),
      blink: (
        d, o
      ) => [
        tick(
          0,
          {
            freq: o.base * 2,
            duration: 0.02,
            gain: o.gain
          }
        ),
        voice(
          0,
          {
            type: "square",
            freq: o.base,
            duration: 0.06,
            attack: 0.001,
            gain: o.gain * 0.8
          }
        )
      ]
    }
  },

  twisting: {
    label: "Twisting",
    base: 400,
    defaultVariant: "wobble",
    variants: {
      wobble: (
        d, o
      ) => repeat(
        Math.max(
          6,
          Math.round( d * 14 )
        ),
        (
          i, phase
        ) => voice(
          phase,
          {
            type: "triangle",
            freq: o.base * ( 1 + 0.35 * Math.sin( phase * Math.PI * 4 ) ),
            duration: 0.06,
            attack: 0.003,
            gain: o.gain * 0.6
          }
        )
      ),
      screw: (
        d, o
      ) => repeat(
        Math.max(
          6,
          Math.round( d * 14 )
        ),
        (
          i, phase
        ) => voice(
          phase,
          {
            type: "sawtooth",
            freq: o.base * ( 1 + phase ) * ( 1 + 0.2 * Math.sin( phase * Math.PI * 6 ) ),
            duration: 0.06,
            attack: 0.003,
            gain: o.gain * 0.55
          }
        )
      )
    }
  },

  stretching: {
    label: "Stretching",
    base: 300,
    defaultVariant: "taffy",
    variants: {
      taffy: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "sawtooth",
            freq: o.base,
            endFreq: o.base * 0.5,
            duration: d * 0.85,
            attack: 0.02,
            gain: o.gain * 0.8
          }
        ),
        voice(
          0.92,
          {
            type: "triangle",
            freq: o.base * 0.5,
            endFreq: o.base * 1.2,
            duration: 0.12,
            attack: 0.004,
            gain: o.gain
          }
        )
      ],
      elastic: (
        d, o
      ) => [
        voice(
          0,
          {
            type: "triangle",
            freq: o.base,
            endFreq: o.base * 1.6,
            duration: d * 0.6,
            attack: 0.02,
            gain: o.gain * 0.7
          }
        ),
        voice(
          0.65,
          {
            type: "triangle",
            freq: o.base * 1.6,
            endFreq: o.base * 0.9,
            duration: d * 0.3,
            attack: 0.01,
            gain: o.gain * 0.6
          }
        )
      ]
    }
  },

  breaking: {
    label: "Breaking",
    base: 220,
    defaultVariant: "shatter",
    variants: {
      shatter: (
        d, o
      ) => {
        const shards = o.shards ?? 9;
        const events = [
          voice(
            0,
            {
              type: "triangle",
              freq: o.base,
              endFreq: o.base * 0.4,
              duration: 0.16,
              attack: 0.002,
              gain: o.gain
            }
          )
        ];

        for ( let i = 0; i < shards; i++ ) {
          const j = hashRandom( i + 3 );
          const k = hashRandom( i + 17 );

          events.push( tick(
            0.03 + j * 0.45,
            {
              freq: 1800 + k * 4000,
              duration: 0.03 + k * 0.04,
              gain: o.gain * ( 0.3 + j * 0.5 )
            }
          ) );
        }

        return events;
      },
      crack: (
        d, o
      ) => [
        tick(
          0,
          {
            freq: 2600,
            duration: 0.04,
            gain: o.gain
          }
        ),
        voice(
          0.02,
          {
            type: "triangle",
            freq: o.base,
            endFreq: o.base * 0.5,
            duration: 0.18,
            attack: 0.002,
            gain: o.gain * 0.9
          }
        ),
        tick(
          0.12,
          {
            freq: 1500,
            duration: 0.05,
            gain: o.gain * 0.5
          }
        )
      ]
    }
  }
};

/** Ordered list of category keys (drives layout + the options form). */
export const CATEGORY_LIST = Object.keys( SOUND_LIBRARY );

export function categoryLabel( category ) {
  return SOUND_LIBRARY[ category ]?.label ?? category;
}

export function categoryBase( category ) {
  return SOUND_LIBRARY[ category ]?.base ?? 440;
}

export function listVariants( category ) {
  return Object.keys( SOUND_LIBRARY[ category ]?.variants ?? {} );
}

export function defaultVariant( category ) {
  return SOUND_LIBRARY[ category ]?.defaultVariant;
}

/**
 * Resolve a category + variant into a time-sorted schedule for one shape.
 * `tuning` carries `{ base, gain, flashes, shards }`.
 */
export function buildSchedule(
  category, variant, duration, tuning
) {
  const cat = SOUND_LIBRARY[ category ];

  if ( !cat ) {
    return [];
  }

  const make = cat.variants[ variant ] ?? cat.variants[ cat.defaultVariant ];
  const events = make(
    duration,
    tuning
  );

  return events.slice().sort( (
    a, b
  ) => a.at - b.at );
}

function applyPitch(
  params, multiplier
) {
  const next = {
    ...params
  };

  if ( typeof next.freq === "number" ) {
    next.freq *= multiplier;
  }

  if ( typeof next.endFreq === "number" ) {
    next.endFreq *= multiplier;
  }

  return next;
}

/**
 * Multiply a single-shape schedule into a group of `count` shapes.
 *
 *   - "unison"   every shape plays the same event at the same time
 *   - "chord"    shapes are stacked into a harmonic spread (up to an octave)
 *   - "arpeggio" shapes are delayed in time so the group rolls out in sequence
 *   - "detune"   shapes are slightly pitch-spread around the center for a chorus
 *
 * `spread` (0..1) scales the harmonic / detune width, `sequenceSpread` (0..1)
 * scales the arpeggio delay as a fraction of the animation duration.
 */
export function expandForGroup(
  events, group
) {
  const count = Math.max(
    1,
    Math.round( group.count ?? 1 )
  );

  if ( count === 1 ) {
    return events;
  }

  const mode = group.mode ?? "unison";
  const spread = group.spread ?? 0.5;
  const sequenceSpread = group.sequenceSpread ?? 0.5;
  const out = [];

  for ( let k = 0; k < count; k++ ) {
    const t = count > 1 ? k / ( count - 1 ) : 0;

    let multiplier = 1;

    if ( mode === "chord" ) {
      multiplier = Math.pow(
        SEMITONE,
        Math.round( spread * 12 * t )
      );
    } else if ( mode === "detune" ) {
      multiplier = 1 + spread * 0.12 * ( t - 0.5 );
    }

    const timeShift = mode === "arpeggio" ? t * sequenceSpread : 0;

    for ( const event of events ) {
      out.push( {
        at: Math.min(
          0.999,
          event.at + timeShift
        ),
        name: event.name,
        params: applyPitch(
          event.params,
          multiplier
        )
      } );
    }
  }

  return out;
}

export default SOUND_LIBRARY;
