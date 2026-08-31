import type {
  Piece
} from "@/types/music.types";

/**
 * The worked example `docs/music/model.md` refers to — a 32-bar piece described
 * end to end with the descriptive layer alone: no pitches, no audio, no notes.
 *
 * It lives here rather than in a fenced code block so the compiler keeps it
 * honest: `npm run typecheck` compiles it against `music.types.ts`, and a
 * documentation snippet that has drifted from the types cannot survive.
 *
 * The shape it demonstrates is the one worth internalising: **tension climbs
 * through the build, peaks in the bar of silence, and the drop is the
 * release** — the loud moment is not the tense one. A visual bound to the
 * `tension` curve therefore relaxes exactly where the music gets big, which is
 * the opposite of what binding a visual to loudness would do.
 */
const EXAMPLE_PIECE: Piece = {
  id: "example-32-bars",
  title: "Thirty-two bars, described",
  source: "Hand-written reference for docs/music/model.md",
  lengthBars: 32,

  time: {
    tempo: [
      {
        at: {
          bar: 1,
          beat: 1
        },
        bpm: 120
      }
    ],
    meter: [
      {
        at: {
          bar: 1,
          beat: 1
        },
        signature: {
          numerator: 4,
          denominator: 4
        }
      }
    ],
    feel: "straight"
  },

  sections: [
    {
      id: "intro",
      role: "intro",
      start: {
        bar: 1,
        beat: 1
      },
      lengthBars: 8
    },
    {
      id: "verse",
      role: "verse",
      start: {
        bar: 9,
        beat: 1
      },
      lengthBars: 8,
      // Two call/response pairs: the second answers with altered material, so
      // the listener hears the same question asked twice and answered better.
      phrases: [
        {
          id: "verse-call-1",
          role: "call",
          start: {
            bar: 9,
            beat: 1
          },
          lengthBars: 2,
          motifId: "hook"
        },
        {
          id: "verse-response-1",
          role: "response",
          answers: "verse-call-1",
          start: {
            bar: 11,
            beat: 1
          },
          lengthBars: 2
        },
        {
          id: "verse-call-2",
          role: "call",
          start: {
            bar: 13,
            beat: 1
          },
          lengthBars: 2,
          motifId: "hook"
        },
        {
          id: "verse-response-2",
          role: "response",
          answers: "verse-call-2",
          start: {
            bar: 15,
            beat: 1
          },
          lengthBars: 2,
          label: "Answered by a deceptive cadence instead of the tonic"
        }
      ]
    },
    {
      id: "buildup",
      role: "buildup",
      start: {
        bar: 17,
        beat: 1
      },
      lengthBars: 8,
      phrases: [
        {
          role: "statement",
          start: {
            bar: 17,
            beat: 1
          },
          lengthBars: 6
        },
        {
          role: "fill",
          start: {
            bar: 23,
            beat: 1
          },
          lengthBars: 1
        },
        {
          // The bar everything stops. It is written as an event, not as a gap
          // between two other phrases.
          role: "silence",
          start: {
            bar: 24,
            beat: 1
          },
          lengthBars: 1,
          label: "Full stop before the drop"
        }
      ]
    },
    {
      id: "drop",
      role: "drop",
      start: {
        bar: 25,
        beat: 1
      },
      lengthBars: 8,
      // Same material as the verse, arriving with the full arrangement.
      variationOf: "verse"
    }
  ],

  layers: [
    {
      id: "kick",
      role: "kick",
      register: "low",
      activity: [
        {
          sectionId: "verse",
          density: 0.6
        },
        {
          // Narrower than the section: the kick carries the build, then leaves
          // bar 24 empty. This is why an activity span may bypass `sectionId`.
          from: {
            bar: 17,
            beat: 1
          },
          lengthBars: 7,
          density: 0.8
        },
        {
          sectionId: "drop",
          density: 1
        }
      ]
    },
    {
      id: "bass",
      role: "bass",
      register: "low",
      activity: [
        {
          sectionId: "verse",
          density: 0.5,
          articulation: "staccato"
        },
        {
          sectionId: "drop",
          density: 0.8,
          articulation: "staccato"
        }
      ]
    },
    {
      id: "hats",
      role: "hats",
      register: "high",
      activity: [
        {
          sectionId: "verse",
          density: 0.4
        },
        {
          from: {
            bar: 17,
            beat: 1
          },
          lengthBars: 7,
          // Rising busyness is what a build *is*, expressed as a number rather
          // than as a volume.
          density: 0.9
        },
        {
          sectionId: "drop",
          density: 0.7
        }
      ]
    },
    {
      id: "pad",
      role: "pad",
      register: "mid",
      activity: [
        {
          sectionId: "intro",
          density: 0.2,
          articulation: "sustained"
        },
        {
          sectionId: "verse",
          density: 0.3,
          articulation: "sustained"
        },
        {
          sectionId: "drop",
          density: 0.5,
          articulation: "sustained"
        }
      ]
    },
    {
      id: "lead",
      role: "lead",
      register: "high",
      activity: [
        {
          sectionId: "verse",
          density: 0.5
        },
        {
          sectionId: "drop",
          density: 0.9,
          articulation: "accent"
        }
      ]
    }
  ],

  curves: [
    {
      id: "tension",
      default: 0,
      points: [
        {
          at: {
            bar: 1,
            beat: 1
          },
          value: 0.1
        },
        {
          at: {
            bar: 9,
            beat: 1
          },
          value: 0.25
        },
        {
          at: {
            bar: 16,
            beat: 1
          },
          // The deceptive cadence: the phrase ends unresolved, so tension goes
          // up where a listener expected it to come down.
          value: 0.45
        },
        {
          at: {
            bar: 17,
            beat: 1
          },
          value: 0.4
        },
        {
          at: {
            bar: 23,
            beat: 1
          },
          value: 0.85,
          easing: "easeInQuad"
        },
        {
          at: {
            bar: 24,
            beat: 1
          },
          value: 1
        },
        {
          at: {
            bar: 25,
            beat: 1
          },
          // Release. The drop is loud and relaxed at the same time.
          value: 0.2
        },
        {
          at: {
            bar: 29,
            beat: 1
          },
          value: 0.35
        },
        {
          at: {
            bar: 32,
            beat: 4
          },
          value: 0.1
        }
      ]
    },
    {
      id: "density",
      default: 0,
      points: [
        {
          at: {
            bar: 1,
            beat: 1
          },
          value: 0.15
        },
        {
          at: {
            bar: 9,
            beat: 1
          },
          value: 0.45
        },
        {
          at: {
            bar: 23,
            beat: 4
          },
          value: 0.9
        },
        {
          at: {
            bar: 24,
            beat: 1
          },
          // Density and tension move apart here: nothing is playing, and that
          // is precisely what makes the bar unbearable.
          value: 0
        },
        {
          at: {
            bar: 25,
            beat: 1
          },
          value: 1
        },
        {
          at: {
            bar: 32,
            beat: 4
          },
          value: 0.3
        }
      ]
    }
  ],

  markers: [
    {
      at: {
        bar: 16,
        beat: 1
      },
      kind: "surprise",
      strength: 0.6,
      label: "Deceptive cadence",
      note: "V goes to bVI instead of i — the answer lands somewhere else."
    },
    {
      at: {
        bar: 16,
        beat: 1
      },
      kind: "cadence",
      strength: 0.6
    },
    {
      at: {
        bar: 17,
        beat: 1
      },
      kind: "buildStart",
      strength: 0.5
    },
    {
      at: {
        bar: 24,
        beat: 1
      },
      kind: "silence",
      strength: 1,
      label: "One bar, nothing"
    },
    {
      at: {
        bar: 25,
        beat: 1
      },
      kind: "drop",
      strength: 1
    },
    {
      at: {
        bar: 25,
        beat: 1
      },
      kind: "release",
      strength: 1
    },
    {
      at: {
        bar: 29,
        beat: 1
      },
      kind: "climax",
      strength: 0.8
    }
  ],

  harmony: {
    keys: [
      {
        at: {
          bar: 1,
          beat: 1
        },
        tonic: "A",
        mode: "aeolian"
      }
    ],
    progression: [
      {
        at: {
          bar: 9,
          beat: 1
        },
        chord: "Am7",
        degree: "i",
        durationBeats: 8,
        tension: 0.1
      },
      {
        at: {
          bar: 11,
          beat: 1
        },
        chord: "Dm7",
        degree: "iv",
        durationBeats: 8,
        tension: 0.3
      },
      {
        at: {
          bar: 13,
          beat: 1
        },
        chord: "E7",
        degree: "V7",
        durationBeats: 8,
        tension: 0.8
      },
      {
        at: {
          bar: 15,
          beat: 1
        },
        chord: "Fmaj7",
        degree: "bVI",
        durationBeats: 8,
        cadence: "deceptive",
        tension: 0.6
      }
    ]
  },

  motifs: [
    {
      id: "hook",
      label: "Three notes up, one long note down",
      contour: [
        "up",
        "up",
        "leapDown"
      ],
      rhythm: "x..x..x.",
      lengthBars: 1
    }
  ],

  notes: "Descriptive layer only: enough to drive a visual, not enough to play."
};

export default EXAMPLE_PIECE;
