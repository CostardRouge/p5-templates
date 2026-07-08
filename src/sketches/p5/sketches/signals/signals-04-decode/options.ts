
const FONT_OPTIONS = [
  {
    label: "Space Mono",
    value: "spaceMonoRegular"
  },
  {
    label: "Martian",
    value: "martian"
  },
  {
    label: "Agiro",
    value: "agiro"
  },
  {
    label: "Peix",
    value: "peix"
  }
];

export const formValues = {
  glyph: {
    text: "SIGNAL",
    sizeFactor: 0.19,
    sampleFactor: 0.18,
    font: "spaceMonoRegular"
  },
  signal: {
    scatterWidth: 0.85,
    scatterHeight: 0.5
  },
  render: {
    dotSize: 0.006,
    lines: true
  },
  palette: {
    saturation: 0.28,
    hueSpread: 1.2
  },
  hud: {
    show: true,
    label: "SIGNALS",
    color: [
      180,
      230,
      210
    ]
  },
  audio: {
    enabled: true,
    freq: 520,
    duration: 0.18,
    gain: 0.25
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ]
};

export const formConfiguration: Record<string, any> = {
  glyph: {
    component: "nested-object",
    label: "Glyph",
    fields: {
      text: {
        label: "Text",
        component: "text"
      },
      sizeFactor: {
        label: "Size (× width)",
        component: "slider",
        min: 0.05,
        max: 0.5,
        step: 0.005
      },
      sampleFactor: {
        label: "Sample density",
        component: "slider",
        min: 0.05,
        max: 0.6,
        step: 0.01
      },
      font: {
        label: "Font",
        component: "select",
        options: FONT_OPTIONS
      }
    }
  },
  signal: {
    component: "nested-object",
    label: "Signal (scatter)",
    fields: {
      scatterWidth: {
        label: "Scatter width (× width)",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      scatterHeight: {
        label: "Scatter height (× height)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  render: {
    component: "nested-object",
    label: "Render",
    fields: {
      dotSize: {
        label: "Dot size (× width)",
        component: "slider",
        min: 0.001,
        max: 0.02,
        step: 0.0005
      },
      lines: {
        label: "Connecting lines",
        component: "checkbox"
      }
    }
  },
  palette: {
    component: "nested-object",
    label: "Palette",
    fields: {
      saturation: {
        label: "Saturation (low = elegant)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.05
      }
    }
  },
  hud: {
    component: "nested-object",
    label: "Instrument (HUD)",
    fields: {
      show: {
        label: "Show instrument frame",
        component: "checkbox"
      },
      label: {
        label: "Header label",
        component: "text"
      },
      color: {
        label: "HUD color",
        component: "color"
      }
    }
  },
  audio: {
    component: "nested-object",
    label: "Audio",
    fields: {
      enabled: {
        label: "Lock tone",
        component: "checkbox"
      },
      freq: {
        label: "Frequency",
        component: "slider",
        min: 120,
        max: 1200,
        step: 1
      },
      duration: {
        label: "Note duration",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      gain: {
        label: "Gain",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
