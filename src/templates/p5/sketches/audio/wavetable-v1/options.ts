const MODE_OPTIONS = [
  {
    label: "Shapes (sine → tri → saw → square → pulse)",
    value: "shapes"
  },
  {
    label: "Harmonics (seeded random walk)",
    value: "harmonics"
  },
  {
    label: "FM (2-operator, index sweep)",
    value: "fm"
  },
  {
    label: "Formant (drifting vowel bands)",
    value: "formant"
  }
];

const SOURCE_OPTIONS = [
  {
    label: "Generator (spec below)",
    value: "generator"
  },
  {
    label: "Preset — aurora-pad.json (shared)",
    value: "preset"
  }
];

const ROOT_OPTIONS = [
  "A1",
  "C2",
  "D2",
  "E2",
  "G2",
  "A2",
  "C3",
  "D3",
  "E3",
  "G3",
  "A3"
].map( ( note ) => ( {
  label: note,
  value: note
} ) );

const SCALE_OPTIONS = [
  {
    label: "Minor pentatonic",
    value: "minorPentatonic"
  },
  {
    label: "Major pentatonic",
    value: "majorPentatonic"
  },
  {
    label: "Major",
    value: "major"
  },
  {
    label: "Natural minor",
    value: "naturalMinor"
  },
  {
    label: "Dorian",
    value: "dorian"
  },
  {
    label: "Whole tone",
    value: "wholeTone"
  },
  {
    label: "Chromatic",
    value: "chromatic"
  }
];

const PATTERN_OPTIONS = [
  {
    label: "Up",
    value: "up"
  },
  {
    label: "Down",
    value: "down"
  },
  {
    label: "Up-down",
    value: "upDown"
  },
  {
    label: "Thirds",
    value: "thirds"
  },
  {
    label: "Random (seeded)",
    value: "random"
  }
];

const MORPH_MODE_OPTIONS = [
  {
    label: "Sweep (start → end over the loop)",
    value: "sweep"
  },
  {
    label: "Ping-pong",
    value: "pingPong"
  },
  {
    label: "Static (stay at start)",
    value: "static"
  }
];

export const formValues = {
  wavetable: {
    mode: "harmonics",
    frames: 9,
    frameSize: 320,
    harmonics: 26,
    brightness: 0.74,
    character: 0.1,
    seed: 524,
    name: "aurora-pad"
  },
  notes: {
    root: "D2",
    scale: "majorPentatonic",
    octaves: 2,
    steps: 11,
    pattern: "up",
    gate: 0.35
  },
  audio: {
    enabled: true,
    volume: 0.37,
    attack: 0.273,
    release: 0.27,
    drive: 0.27
  },
  morph: {
    mode: "static",
    start: 0.3,
    end: 1
  },
  io: {
    source: "generator",
    customJson: ""
  },
  look: {
    background: [
      8,
      10,
      14,
      255
    ] as number[],
    wave: [
      130,
      255,
      190,
      255
    ] as number[],
    dim: [
      90,
      110,
      130,
      255
    ] as number[],
    perspective: 1.8,
    showSequencer: true,
    showHud: true
  }
};

export const formConfiguration: Record<string, any> = {
  wavetable: {
    component: "nested-object",
    label: "Wavetable generator",
    fields: {
      mode: {
        label: "Mode",
        component: "select",
        options: MODE_OPTIONS
      },
      frames: {
        label: "Frames (morph stack)",
        component: "slider",
        min: 2,
        max: 16,
        step: 1
      },
      frameSize: {
        label: "Frame size (samples)",
        component: "slider",
        min: 64,
        max: 512,
        step: 64
      },
      harmonics: {
        label: "Harmonics",
        component: "slider",
        min: 1,
        max: 64,
        step: 1
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      character: {
        label: "Character",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      seed: {
        label: "Seed",
        component: "slider",
        min: 1,
        max: 999,
        step: 1
      },
      name: {
        label: "Name (used in the exported .json)",
        component: "text"
      }
    }
  },
  notes: {
    component: "nested-object",
    label: "Notes",
    fields: {
      root: {
        label: "Root note",
        component: "select",
        options: ROOT_OPTIONS
      },
      scale: {
        label: "Scale",
        component: "select",
        options: SCALE_OPTIONS
      },
      octaves: {
        label: "Octave range",
        component: "slider",
        min: 1,
        max: 3,
        step: 1
      },
      steps: {
        label: "Steps per loop",
        component: "slider",
        min: 4,
        max: 32,
        step: 1
      },
      pattern: {
        label: "Pattern",
        component: "select",
        options: PATTERN_OPTIONS
      },
      gate: {
        label: "Gate (note length / step)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.05
      }
    }
  },
  audio: {
    component: "nested-object",
    label: "Audio",
    fields: {
      enabled: {
        label: "Enabled",
        component: "checkbox"
      },
      volume: {
        label: "Volume",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      attack: {
        label: "Attack (s)",
        component: "slider",
        min: 0.001,
        max: 0.5,
        step: 0.001
      },
      release: {
        label: "Release (s)",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01
      },
      drive: {
        label: "Drive (soft clip)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  morph: {
    component: "nested-object",
    label: "Morph",
    fields: {
      mode: {
        label: "Mode",
        component: "select",
        options: MORPH_MODE_OPTIONS
      },
      start: {
        label: "Start position",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      end: {
        label: "End position",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  io: {
    component: "nested-object",
    label: "Wavetable I/O",
    fields: {
      source: {
        label: "Source",
        component: "select",
        options: SOURCE_OPTIONS
      },
      customJson: {
        label: "Custom wavetable .json (paste to load — wins over source)",
        component: "textarea"
      }
    }
  },
  look: {
    component: "nested-object",
    label: "Look",
    fields: {
      background: {
        component: "color",
        label: "Background"
      },
      wave: {
        component: "color",
        label: "Wave (morph curve)"
      },
      dim: {
        component: "color",
        label: "Dim (stack / HUD)"
      },
      perspective: {
        label: "Stack perspective",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      showSequencer: {
        label: "Show step lane",
        component: "checkbox"
      },
      showHud: {
        label: "Show HUD",
        component: "checkbox"
      }
    }
  }
};
