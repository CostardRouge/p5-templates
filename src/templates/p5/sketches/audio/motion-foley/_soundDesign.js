/**
 * Motion-foley sound library — reusable, code-driven "sound effects" that can
 * be associated to any shape animation.
 *
 * Each gesture (appearing, growing, breaking …) carries two banks of sound:
 *
 *   - `tension`  the action itself — fired when the gesture happens. Tension
 *                sounds open up: rising / sustained / unresolved contours.
 *   - `release`  the resolution — fired when the gesture relaxes back to rest.
 *                Release sounds close down: they descend toward the base
 *                frequency ("home"), are softer and shorter, and give the ear a
 *                sense of completion. A `release` of `null` means the gesture
 *                does not resolve (no release sound at all).
 *
 * A bank is a set of named *variants*. A variant is a pure function
 *
 *     ( duration, tuning ) => [ { at, name, params }, … ]
 *
 * returning a deterministic *schedule* of sound events:
 *
 *   - `at`     fraction [0..1] of the phase duration at which the event fires
 *   - `name`   a synth preset understood by utils/audio.js ( "beep" | "tick" )
 *   - `params` oscillator / envelope params
 *              ( { type, freq, endFreq, duration, attack, gain } )
 *
 * Returning fractional schedules (instead of playing immediately) is what makes
 * the sounds reusable and stretchable: the consumer multiplies `at` by the real
 * phase length and fires each event when the playhead crosses it. Transient
 * gestures keep a short fixed envelope; sustained ones derive their envelope
 * length from `duration`, so the audio always starts and ends with the motion.
 *
 * `expandForGroup()` then answers the "one or many items" question: when a
 * gesture renders several shapes at once, a schedule is multiplied into a
 * unison, a chord, an arpeggio or a detuned cluster.
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
    tension: {
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
    release: {
      defaultVariant: "settle",
      variants: {
        settle: (
          d, o
        ) => [
          voice(
            0,
            {
              type: "sine",
              freq: o.base * 1.5,
              endFreq: o.base * 0.75,
              duration: d * 0.7,
              attack: 0.005,
              gain: o.gain * 0.6
            }
          ),
          voice(
            0.12,
            {
              type: "sine",
              freq: o.base * 0.75,
              duration: d * 0.5,
              attack: 0.005,
              gain: o.gain * 0.4
            }
          )
        ],
        poof: (
          d, o
        ) => [
          tick(
            0,
            {
              freq: o.base * 3,
              duration: 0.03,
              gain: o.gain * 0.4
            }
          ),
          voice(
            0,
            {
              type: "sine",
              freq: o.base,
              endFreq: o.base * 0.5,
              duration: d * 0.6,
              attack: 0.004,
              gain: o.gain * 0.5
            }
          )
        ]
      }
    }
  },

  growing: {
    label: "Growing",
    base: 330,
    tension: {
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
    release: {
      defaultVariant: "settle",
      variants: {
        settle: (
          d, o
        ) => [
          voice(
            0,
            {
              type: "sawtooth",
              freq: o.base * 4,
              endFreq: o.base,
              duration: d * 0.85,
              attack: 0.02,
              gain: o.gain * 0.65
            }
          )
        ]
      }
    }
  },

  reducing: {
    label: "Reducing",
    base: 720,
    tension: {
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
    release: {
      defaultVariant: "restore",
      variants: {
        restore: (
          d, o
        ) => [
          voice(
            0,
            {
              type: "triangle",
              freq: o.base * 0.6,
              endFreq: o.base,
              duration: d * 0.8,
              attack: 0.02,
              gain: o.gain * 0.65
            }
          )
        ]
      }
    }
  },

  shaking: {
    label: "Shaking",
    base: 180,
    tension: {
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
    release: {
      defaultVariant: "settle",
      variants: {
        settle: (
          d, o
        ) => [
          voice(
            0,
            {
              type: "sine",
              freq: o.base * 2,
              endFreq: o.base,
              duration: d * 0.7,
              attack: 0.01,
              gain: o.gain * 0.6
            }
          )
        ]
      }
    }
  },

  sliding: {
    label: "Sliding",
    base: 480,
    tension: {
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
    release: {
      defaultVariant: "return",
      variants: {
        return: (
          d, o
        ) => [
          voice(
            0,
            {
              type: "sine",
              freq: o.base * 1.8,
              endFreq: o.base * 0.6,
              duration: d,
              attack: d * 0.3,
              gain: o.gain * 0.7
            }
          )
        ]
      }
    }
  },

  fading: {
    label: "Fading in / out",
    base: 520,
    tension: {
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
    release: {
      defaultVariant: "out",
      variants: {
        out: (
          d, o
        ) => [
          voice(
            0,
            {
              type: "sine",
              freq: o.base,
              endFreq: o.base * 0.85,
              duration: d,
              attack: 0.01,
              gain: o.gain * 0.7
            }
          )
        ]
      }
    }
  },

  flashing: {
    label: "Flashing",
    base: 1200,
    tension: {
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
    release: {
      defaultVariant: "resolve",
      variants: {
        resolve: (
          d, o
        ) => [
          voice(
            0,
            {
              type: "sine",
              freq: o.base,
              duration: d * 0.8,
              attack: 0.02,
              gain: o.gain * 0.55
            }
          ),
          voice(
            0,
            {
              type: "sine",
              freq: o.base * 0.5,
              duration: d * 0.8,
              attack: 0.02,
              gain: o.gain * 0.4
            }
          )
        ]
      }
    }
  },

  twisting: {
    label: "Twisting",
    base: 400,
    tension: {
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
    release: {
      defaultVariant: "unwind",
      variants: {
        unwind: (
          d, o
        ) => [
          voice(
            0,
            {
              type: "triangle",
              freq: o.base * 1.4,
              endFreq: o.base,
              duration: d * 0.8,
              attack: 0.01,
              gain: o.gain * 0.6
            }
          )
        ]
      }
    }
  },

  stretching: {
    label: "Stretching",
    base: 300,
    tension: {
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
          )
        ]
      }
    },
    release: {
      defaultVariant: "snap",
      variants: {
        snap: (
          d, o
        ) => [
          voice(
            0,
            {
              type: "triangle",
              freq: o.base * 1.8,
              endFreq: o.base,
              duration: 0.18,
              attack: 0.004,
              gain: o.gain
            }
          ),
          voice(
            0.14,
            {
              type: "sine",
              freq: o.base,
              duration: d * 0.45,
              attack: 0.01,
              gain: o.gain * 0.5
            }
          )
        ]
      }
    }
  },

  breaking: {
    label: "Breaking",
    base: 220,
    tension: {
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
    },
    // The shards converge again and land on a clean, consonant bell — the
    // object reassembles itself.
    release: {
      defaultVariant: "reform",
      variants: {
        reform: (
          d, o
        ) => {
          const shards = o.shards ?? 9;
          const events = [];

          for ( let i = 0; i < shards; i++ ) {
            const j = hashRandom( i + 5 );

            events.push( tick(
              0.05 + ( 1 - j ) * 0.4,
              {
                freq: 2000 + j * 3000,
                duration: 0.025,
                gain: o.gain * ( 0.2 + j * 0.3 )
              }
            ) );
          }

          events.push( voice(
            0.55,
            {
              type: "sine",
              freq: o.base * 2,
              duration: d * 0.45,
              attack: 0.01,
              gain: o.gain * 0.55
            }
          ) );
          events.push( voice(
            0.58,
            {
              type: "sine",
              freq: o.base * 3,
              duration: d * 0.4,
              attack: 0.01,
              gain: o.gain * 0.4
            }
          ) );

          return events;
        }
      }
    }
  }
};

/** Ordered list of gesture keys (drives layout + the options form). */
export const CATEGORY_LIST = Object.keys( SOUND_LIBRARY );

export function categoryLabel( category ) {
  return SOUND_LIBRARY[ category ]?.label ?? category;
}

export function categoryBase( category ) {
  return SOUND_LIBRARY[ category ]?.base ?? 440;
}

function bankOf(
  category, phase
) {
  const cat = SOUND_LIBRARY[ category ];

  if ( !cat ) {
    return null;
  }

  return phase === "release" ? cat.release : cat.tension;
}

export function listVariants(
  category, phase = "tension"
) {
  return Object.keys( bankOf(
    category,
    phase
  )?.variants ?? {} );
}

export function defaultVariant(
  category, phase = "tension"
) {
  return bankOf(
    category,
    phase
  )?.defaultVariant;
}

/**
 * Default release selection per gesture. Beyond a custom variant name, two
 * special values drive the resolution:
 *
 *   - "none"     the gesture does not resolve (symmetric gestures such as
 *                shaking, which already returns to where it started).
 *   - "reverse"  the release is auto-derived from the chosen tension sound by
 *                playing it backwards — a guaranteed matching pair, and the
 *                filmic "rewind" that makes breaking read as a reassembly.
 */
const DEFAULT_RELEASE = {
  appearing: "reverse",
  growing: "reverse",
  reducing: "reverse",
  shaking: "none",
  sliding: "reverse",
  fading: "reverse",
  flashing: "resolve",
  twisting: "reverse",
  stretching: "reverse",
  breaking: "reverse"
};

export function defaultRelease( category ) {
  return DEFAULT_RELEASE[ category ] ?? "reverse";
}

/** Hand-authored release variant names available for a gesture (may be empty). */
export function customReleaseVariants( category ) {
  return Object.keys( bankOf(
    category,
    "release"
  )?.variants ?? {} );
}

function sortByAt( events ) {
  return events.slice().sort( (
    a, b
  ) => a.at - b.at );
}

/** Build a tension schedule for one shape (time-sorted). */
export function buildTension(
  category, variant, duration, tuning
) {
  const bank = bankOf(
    category,
    "tension"
  );

  if ( !bank ) {
    return [];
  }

  const make = bank.variants[ variant ] ?? bank.variants[ bank.defaultVariant ];

  return make ? sortByAt( make(
    duration,
    tuning
  ) ) : [];
}

/**
 * Time-reverse a schedule into its matching release: each event is mirrored to
 * the far end of the timeline (so a rising sequence plays as a falling one) and
 * any pitch sweep is flipped (start ↔ end frequency). The result is the same
 * gesture "rewound", which is exactly what a release should feel like.
 */
function reverseSchedule(
  events, duration
) {
  const reversed = events.map( ( event ) => {
    const durationFraction = duration > 0
      ? Math.min(
        1,
        ( event.params.duration ?? 0 ) / duration
      )
      : 0;
    const at = Math.max(
      0,
      Math.min(
        0.999,
        1 - event.at - durationFraction
      )
    );
    const params = {
      ...event.params
    };

    if ( typeof params.freq === "number" && typeof params.endFreq === "number" ) {
      const swap = params.freq;

      params.freq = params.endFreq;
      params.endFreq = swap;
    }

    return {
      at,
      name: event.name,
      params
    };
  } );

  return sortByAt( reversed );
}

/**
 * Build a release schedule. `selection` is "none", "reverse" (mirror of the
 * given `tensionVariant`) or a custom release variant name.
 */
export function buildRelease(
  category, selection, duration, tuning, tensionVariant
) {
  if ( !selection || selection === "none" ) {
    return [];
  }

  if ( selection === "reverse" ) {
    return reverseSchedule(
      buildTension(
        category,
        tensionVariant,
        duration,
        tuning
      ),
      duration
    );
  }

  const bank = bankOf(
    category,
    "release"
  );
  const make = bank?.variants[ selection ];

  return make ? sortByAt( make(
    duration,
    tuning
  ) ) : [];
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
 * scales the arpeggio delay as a fraction of the phase duration.
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
