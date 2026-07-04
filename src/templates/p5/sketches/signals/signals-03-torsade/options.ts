
const AXIS_OPTIONS = [
  {
    label: "Vertical",
    value: "vertical"
  },
  {
    label: "Horizontal",
    value: "horizontal"
  }
];

export const formValues = {
  timeScale: 1,
  layout: {
    xCount: 3,
    yCount: 1,
    sizeDivisor: 3.5,
    axis: "vertical"
  },
  spiral: {
    lerpSteps: 320,
    waveAmplitudeDivisor: 3.8,
    circleSize: 122,
    cadenceMin: -5.9,
    cadenceMax: 5
  },
  motion: {
    cadenceSpeed: 1,
    cadenceIndexScale: 1.1500000000000001
  },
  colors: {
    hueSpeed: 1,
    hueSpread: 2,
    huePhase: 0.05,
    indexHueShift: 1,
    shimmer: 3.6,
    saturation: 0.31,
    brightness: 1.21
  },
  hud: {
    show: true,
    label: "SIGNALS",
    color: [
      180,
      230,
      210
    ],
    verticalMargin: 0.05
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ]
};

export const formConfiguration: Record<string, any> = {
  timeScale: {
    label: "Time scale (loops, integer)",
    component: "slider",
    min: 0,
    max: 4,
    step: 1
  },
  layout: {
    component: "nested-object",
    label: "Layout",
    fields: {
      xCount: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      yCount: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      sizeDivisor: {
        label: "Cell size divisor",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.1
      },
      axis: {
        label: "Spiral axis",
        component: "select",
        options: AXIS_OPTIONS
      }
    }
  },
  spiral: {
    component: "nested-object",
    label: "Spiral",
    fields: {
      lerpSteps: {
        label: "Samples",
        component: "slider",
        min: 1,
        max: 320,
        step: 1
      },
      waveAmplitudeDivisor: {
        label: "Wave amplitude divisor",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      },
      circleSize: {
        label: "Disc size",
        component: "slider",
        min: 10,
        max: 600,
        step: 1
      },
      cadenceMin: {
        label: "Cadence min",
        component: "slider",
        min: -20,
        max: 0,
        step: 0.1
      },
      cadenceMax: {
        label: "Cadence max",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      cadenceSpeed: {
        label: "Cadence speed (loops, integer)",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      cadenceIndexScale: {
        label: "Cadence index scale",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Iridescent (low-sat)",
    fields: {
      hueSpeed: {
        label: "Hue speed (loops, integer)",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      hueSpread: {
        label: "Hue spread (× speed = integer)",
        component: "slider",
        min: 0,
        max: 10,
        step: 1
      },
      huePhase: {
        label: "Hue phase",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      indexHueShift: {
        label: "Index hue shift",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      shimmer: {
        label: "Shimmer (oil-slick)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      saturation: {
        label: "Saturation (low = elegant)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
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
      },
      verticalMargin: {
        label: "Frame vertical margin",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
