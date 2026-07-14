const FONT_OPTIONS = [
  {
    label: "Space Mono",
    value: "spaceMonoRegular"
  },
  {
    label: "Space Mono Italic",
    value: "spaceMonoItalic"
  },
  {
    label: "Martian Mono",
    value: "martian"
  }
];

const PALETTE_OPTIONS = [
  {
    label: "Komputery (bold primaries)",
    value: "komputery"
  },
  {
    label: "CRT (terminal green)",
    value: "crt"
  },
  {
    label: "Hot (red / orange / yellow)",
    value: "hot"
  }
];

const COLOR_MODE_OPTIONS = [
  {
    label: "Pulse (mono field + beat ring)",
    value: "pulse"
  },
  {
    label: "Spectrum (colour bands)",
    value: "spectrum"
  }
];

const WAVEFORM_OPTIONS = [
  {
    label: "Square",
    value: "square"
  },
  {
    label: "Sawtooth",
    value: "sawtooth"
  },
  {
    label: "Triangle",
    value: "triangle"
  },
  {
    label: "Sine",
    value: "sine"
  }
];

// Default values only — exposed at runtime as `options.sketch.*`.
export const formValues = {
  grid: {
    columns: 22,
    font: "spaceMonoRegular",
    ramp: " .:-=+*#%@",
    glyphScale: 1.15
  },

  // Wave motion. waveCycles / arms are whole numbers so the field loops
  // seamlessly (they are integer cycles per loop / angular frequency).
  wave: {
    waveCycles: 3,
    radialFreq: 5,
    arms: 3,
    baseWeight: 0.75,
    contrast: 1.4
  },

  // The beat that drives both the visual ring punch and the audio. beatsPerLoop
  // is a whole number so the pulse is seamless across the loop.
  beat: {
    beatsPerLoop: 8,
    reach: 0.95,
    ringWidth: 0.12,
    pulseStrength: 1.1,
    thump: 0.25
  },

  // Generated sound, locked to the beat. Rendered offline for exports.
  audio: {
    enabled: true,
    volume: 0.5,
    rootMidi: 36,
    waveform: "square",
    noteLength: 0.16,
    blip: true
  },

  colors: {
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
  }
};

// UI configuration only.
export const formConfiguration: Record<string, any> = {
  grid: {
    component: "nested-object",
    label: "Grid",
    initialExpanded: true,
    fields: {
      columns: {
        component: "slider",
        label: "Columns (rows follow aspect)",
        min: 6,
        max: 80,
        step: 1
      },
      font: {
        component: "select",
        label: "Monospace font",
        options: FONT_OPTIONS
      },
      ramp: {
        component: "text",
        label: "Glyph ramp (dark → bright)"
      },
      glyphScale: {
        component: "slider",
        label: "Glyph scale",
        min: 0.5,
        max: 2,
        step: 0.05
      }
    }
  },

  wave: {
    component: "nested-object",
    label: "Wave",
    initialExpanded: true,
    fields: {
      waveCycles: {
        component: "slider",
        label: "Wave cycles per loop",
        min: 0,
        max: 8,
        step: 1
      },
      radialFreq: {
        component: "slider",
        label: "Radial frequency (rings)",
        min: 0,
        max: 20,
        step: 0.5
      },
      arms: {
        component: "slider",
        label: "Arms (angular frequency)",
        min: 0,
        max: 16,
        step: 1
      },
      baseWeight: {
        component: "slider",
        label: "Wave weight",
        min: 0,
        max: 1.5,
        step: 0.05
      },
      contrast: {
        component: "slider",
        label: "Contrast",
        min: 0.5,
        max: 4,
        step: 0.05
      }
    }
  },

  beat: {
    component: "nested-object",
    label: "Beat",
    initialExpanded: true,
    fields: {
      beatsPerLoop: {
        component: "slider",
        label: "Beats per loop",
        min: 1,
        max: 32,
        step: 1
      },
      reach: {
        component: "slider",
        label: "Ring reach",
        min: 0.2,
        max: 1.5,
        step: 0.05
      },
      ringWidth: {
        component: "slider",
        label: "Ring width",
        min: 0.02,
        max: 0.5,
        step: 0.01
      },
      pulseStrength: {
        component: "slider",
        label: "Ring intensity",
        min: 0,
        max: 3,
        step: 0.1
      },
      thump: {
        component: "slider",
        label: "Whole-grid thump",
        min: 0,
        max: 1,
        step: 0.05
      }
    }
  },

  audio: {
    component: "nested-object",
    label: "Sound",
    initialExpanded: true,
    fields: {
      enabled: {
        component: "checkbox",
        label: "Generate sound"
      },
      volume: {
        component: "slider",
        label: "Volume",
        min: 0,
        max: 1,
        step: 0.05
      },
      rootMidi: {
        component: "slider",
        label: "Root note (MIDI)",
        min: 24,
        max: 60,
        step: 1
      },
      waveform: {
        component: "select",
        label: "Bass waveform",
        options: WAVEFORM_OPTIONS
      },
      noteLength: {
        component: "slider",
        label: "Note length (s)",
        min: 0.04,
        max: 0.6,
        step: 0.01
      },
      blip: {
        component: "checkbox",
        label: "Off-beat blip"
      }
    }
  },

  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      palette: {
        component: "select",
        label: "Palette",
        options: PALETTE_OPTIONS
      },
      colorMode: {
        component: "select",
        label: "Color mode",
        options: COLOR_MODE_OPTIONS
      },
      baseColor: {
        component: "color",
        label: "Field base color (pulse mode)"
      },
      ringColorBoost: {
        component: "slider",
        label: "Ring color boost",
        min: 0.5,
        max: 5,
        step: 0.1
      },
      backgroundColor: {
        component: "color",
        label: "Background color"
      }
    }
  }
};
