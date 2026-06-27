import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  shape: {
    quality: 1172,
    verticalMargin: 0.19,
    amplitude: 0.205,
    frequency: 2,
    breath: 0.06
  },
  lines: {
    maxCount: 4.3,
    changeOverTime: false,
    length: 0.091,
    weight: 0.038,
    angleSpan: 3.78
  },
  palette: {
    saturation: 0.75,
    hueSpeed: 5,
    hueSpread: 2.25
  },
  rotation: {
    count: -3.15,
    speed: 0
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
    baseFreq: 220,
    freqSpan: 660,
    duration: 0.22,
    gain: 0.28
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      quality: {
        label: "Quality",
        component: "slider",
        min: 40,
        max: 1200,
        step: 1
      },
      verticalMargin: {
        label: "Vertical margin",
        component: "slider",
        min: 0,
        max: 0.4,
        step: 0.005
      },
      amplitude: {
        label: "Amplitude",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.005
      },
      frequency: {
        label: "Frequency (loops, integer)",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      breath: {
        label: "Breath",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      }
    }
  },
  lines: {
    component: "nested-object",
    label: "Lines",
    fields: {
      maxCount: {
        label: "Max fan count",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
      },
      changeOverTime: {
        label: "Change fan count over time",
        component: "checkbox"
      },
      length: {
        label: "Line length",
        component: "slider",
        min: 0.01,
        max: 0.25,
        step: 0.001
      },
      weight: {
        label: "Line weight",
        component: "slider",
        min: 0.005,
        max: 0.16,
        step: 0.001
      },
      angleSpan: {
        label: "Line angle span",
        component: "slider",
        min: 0.1,
        max: 6.28,
        step: 0.01
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
      hueSpeed: {
        label: "Hue speed (loops, integer)",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
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
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      count: {
        label: "Rotation count",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      speed: {
        label: "Rotation speed (loops, integer)",
        component: "slider",
        min: -5,
        max: 5,
        step: 1
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
        label: "Enable sound on crossings",
        component: "checkbox"
      },
      baseFreq: {
        label: "Base frequency",
        component: "slider",
        min: 80,
        max: 600,
        step: 1
      },
      freqSpan: {
        label: "Frequency span",
        component: "slider",
        min: 0,
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
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
