const THEME_OPTIONS = [
  {
    label: "Neon Genesis",
    value: "neonGenesis"
  },
  {
    label: "Phosphor",
    value: "phosphor"
  },
  {
    label: "Amber CRT",
    value: "amber"
  },
  {
    label: "Vaporwave",
    value: "vaporwave"
  },
  {
    label: "Crimson Alert",
    value: "crimson"
  }
];

export const formValues = {
  theme: "neonGenesis",
  header: {
    show: true,
    company: "SYNASTAR CO.",
    title: "DATA EXTRACTION",
    version: "V.732F7"
  },
  oscilloscope: {
    show: true,
    traces: 14,
    frequency: 3,
    amplitude: 1,
    speed: 2,
    carrier: true
  },
  terrain: {
    show: true,
    cols: 40,
    rows: 24,
    height: 1,
    detail: 0.35,
    cloud: true,
    cloudDensity: 2
  },
  segments: {
    show: true,
    sampleMax: 99999
  },
  border: {
    show: true,
    dashSpeed: 6
  },
  overlay: {
    scanlines: true,
    vignette: true,
    grain: 0.6,
    flicker: 0.3
  },
  backgroundColor: [
    6,
    9,
    12
  ]
};

export const formConfiguration: Record<string, any> = {
  theme: {
    label: "Theme",
    component: "select",
    options: THEME_OPTIONS
  },
  header: {
    component: "nested-object",
    label: "Header",
    initialExpanded: true,
    fields: {
      show: {
        label: "Show header",
        component: "checkbox"
      },
      company: {
        label: "Company",
        component: "text"
      },
      title: {
        label: "Title",
        component: "text"
      },
      version: {
        label: "Version",
        component: "text"
      }
    }
  },
  oscilloscope: {
    component: "nested-object",
    label: "Oscilloscope",
    fields: {
      show: {
        label: "Show oscilloscope",
        component: "checkbox"
      },
      traces: {
        label: "Interference traces",
        component: "slider",
        min: 1,
        max: 32,
        step: 1
      },
      frequency: {
        label: "Base frequency",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.5
      },
      amplitude: {
        label: "Amplitude",
        component: "slider",
        min: 0.2,
        max: 1.6,
        step: 0.05
      },
      speed: {
        label: "Sweep speed (loops)",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      carrier: {
        label: "Green carrier wave",
        component: "checkbox"
      }
    }
  },
  terrain: {
    component: "nested-object",
    label: "Terrain scan",
    fields: {
      show: {
        label: "Show terrain",
        component: "checkbox"
      },
      cols: {
        label: "Grid columns",
        component: "slider",
        min: 12,
        max: 72,
        step: 2
      },
      rows: {
        label: "Grid rows (depth)",
        component: "slider",
        min: 8,
        max: 48,
        step: 2
      },
      height: {
        label: "Relief height",
        component: "slider",
        min: 0.2,
        max: 2,
        step: 0.05
      },
      detail: {
        label: "Craggy detail",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      cloud: {
        label: "Point cloud",
        component: "checkbox"
      },
      cloudDensity: {
        label: "Cloud sparsity (higher = fewer)",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      }
    }
  },
  segments: {
    component: "nested-object",
    label: "Segmented readouts",
    fields: {
      show: {
        label: "Show readouts",
        component: "checkbox"
      },
      sampleMax: {
        label: "Sample counter max",
        component: "slider",
        min: 999,
        max: 99999,
        step: 1000
      }
    }
  },
  border: {
    component: "nested-object",
    label: "Containment border",
    fields: {
      show: {
        label: "Show border",
        component: "checkbox"
      },
      dashSpeed: {
        label: "Marching-ants speed",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      }
    }
  },
  overlay: {
    component: "nested-object",
    label: "CRT overlay",
    fields: {
      scanlines: {
        label: "Scanlines",
        component: "checkbox"
      },
      vignette: {
        label: "Vignette",
        component: "checkbox"
      },
      grain: {
        label: "Sensor grain",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      flicker: {
        label: "Flicker",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
