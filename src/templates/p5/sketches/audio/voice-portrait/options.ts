import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";
import {
  webcamSourceFormValues,
  webcamSourceFormConfiguration
} from "@/p5/utils/webcam/defaults.js";

// Default values only — exposed at runtime as `options.sketch.*`
export const formValues = {
  // Microphone only — the camera is the separate webcam block below.
  interaction: {
    ...interactionFormValues,
    audio: {
      ...interactionFormValues.audio,
      enabled: true,
      features: {
        ...interactionFormValues.audio.features,
        bands: true,
        kick: true,
        voice: true
      }
    }
  },

  camera: {
    ...webcamSourceFormValues
  },

  backgroundColor: [
    8,
    8,
    12
  ],

  // The dot grid the portrait is rebuilt from
  grid: {
    columns: 48,
    mirror: true
  },

  // How the sound tears the portrait apart
  reaction: {
    scatter: 0.25,
    bassPulse: 1.2,
    smoothing: 0.25,
    noiseFloor: 0.04,
    kickRings: true,
    ringSpeed: 0.02
  },

  // How the dots look
  appearance: {
    colorMode: "source",
    dotScale: 0.9,
    threshold: 0.06,
    invertBrightness: false,
    shadow: [
      20,
      24,
      60
    ],
    highlight: [
      255,
      240,
      220
    ]
  },

  // Overlay text
  overlay: {
    show: true,
    caption: "🔊 turn your sound on"
  }
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,

  camera: webcamSourceFormConfiguration,

  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  grid: {
    component: "nested-object",
    label: "Grid",
    initialExpanded: true,
    fields: {
      columns: {
        component: "slider",
        label: "Columns",
        min: 12,
        max: 160,
        step: 2
      },
      mirror: {
        component: "checkbox",
        label: "Mirror camera"
      }
    }
  },

  reaction: {
    component: "nested-object",
    label: "Sound reaction",
    initialExpanded: true,
    fields: {
      scatter: {
        component: "slider",
        label: "Voice scatter (× canvas width)",
        min: 0,
        max: 1,
        step: 0.01
      },
      bassPulse: {
        component: "slider",
        label: "Bass dot pulse",
        min: 0,
        max: 4,
        step: 0.1
      },
      smoothing: {
        component: "slider",
        label: "Level smoothing (higher = snappier)",
        min: 0.02,
        max: 1,
        step: 0.01
      },
      noiseFloor: {
        component: "slider",
        label: "Noise floor",
        min: 0,
        max: 0.3,
        step: 0.01
      },
      kickRings: {
        component: "checkbox",
        label: "Shockwave ring on kick"
      },
      ringSpeed: {
        component: "slider",
        label: "Ring speed (× canvas width / frame)",
        min: 0.002,
        max: 0.08,
        step: 0.002
      }
    }
  },

  appearance: {
    component: "nested-object",
    label: "Appearance",
    fields: {
      colorMode: {
        component: "select",
        label: "Dot colors",
        options: [
          {
            label: "Camera colors",
            value: "source"
          },
          {
            label: "Duotone",
            value: "duotone"
          }
        ]
      },
      dotScale: {
        component: "slider",
        label: "Dot scale",
        min: 0.2,
        max: 2,
        step: 0.05
      },
      threshold: {
        component: "slider",
        label: "Brightness cutoff",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      invertBrightness: {
        component: "checkbox",
        label: "Invert brightness (dark = big)"
      },
      shadow: {
        component: "color",
        label: "Duotone shadow"
      },
      highlight: {
        component: "color",
        label: "Duotone highlight (also rings)"
      }
    }
  },

  overlay: {
    component: "nested-object",
    label: "Overlay text",
    fields: {
      show: {
        component: "checkbox",
        label: "Show caption"
      },
      caption: {
        component: "text",
        label: "Caption"
      }
    }
  }
};
