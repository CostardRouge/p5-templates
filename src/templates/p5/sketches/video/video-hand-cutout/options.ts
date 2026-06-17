import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Default values only — exposed at runtime as `options.sketch.*`
export const formValues = {
  // Source + tracking. Same block as splines-v1-interactive: switch Vision →
  // Source between the webcam and a recorded video / image asset (the same
  // footage is shown, cut out AND tracked). Fingers tracking is on by default.
  interaction: {
    ...interactionFormValues,
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false
    },
    vision: {
      ...interactionFormValues.vision,
      enabled: true,
      source: {
        ...interactionFormValues.vision.source,
        mode: "webcam"
      },
      fingers: {
        ...interactionFormValues.vision.fingers,
        enabled: true
      },
      hands: {
        ...interactionFormValues.vision.hands,
        enabled: false,
        landmarks: {
          fingertips: true,
          palm: true
        }
      }
    },
    visualization: {
      ...interactionFormValues.visualization,
      enabled: false
    }
  },

  // The picture behind the echoes.
  display: {
    backgroundColor: [
      8,
      8,
      10
    ],
    showVideo: true,
    videoOpacity: 1
  },

  // How much of the footage is copied: which entities, the brush size/softness,
  // and tracking smoothing.
  mask: {
    region: "vision",
    shape: "hand",
    brushSize: 55,
    feather: 0.55,
    smoothing: 0.3
  },

  // The repeated cutouts: ring depth, how each older layer is offset / grown /
  // twisted, a depth colour tint and how far it fades.
  echo: {
    layers: 24,
    spacing: 1,
    offset: {
      x: 6,
      y: -8
    },
    scaleStep: 0.006,
    rotateStep: 0.4,
    minAlpha: 0,
    colorMix: 0.3,
    opacity: 1,
    frontColor: [
      255,
      240,
      230
    ],
    midColor: [
      255,
      90,
      170
    ],
    backColor: [
      70,
      110,
      255
    ]
  },

  // Optional glowing spline overlay drawn on top of the hands (off by default —
  // the point is to copy the footage, not draw over it).
  splines: {
    enabled: false,
    weight: 14,
    glow: 2,
    gradient: true,
    hueSpeed: 1.5,
    hueSpread: 2,
    iterations: 5
  },

  // Ring buffers render at this fraction of the canvas — lower is faster.
  performance: {
    bufferScale: 0.5
  }
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,

  display: {
    component: "nested-object",
    label: "Display",
    initialExpanded: true,
    fields: {
      backgroundColor: {
        component: "color",
        label: "Background color"
      },
      showVideo: {
        component: "checkbox",
        label: "Show source video"
      },
      videoOpacity: {
        component: "slider",
        label: "Video opacity",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },

  mask: {
    component: "nested-object",
    label: "Cutout mask",
    initialExpanded: true,
    fields: {
      region: {
        component: "select",
        label: "Copied source",
        options: [
          {
            label: "Vision (all cameras)",
            value: "vision"
          },
          {
            label: "Fingers only",
            value: "fingers"
          },
          {
            label: "Hands only",
            value: "hands"
          },
          {
            label: "All pointers",
            value: "all"
          }
        ]
      },
      shape: {
        component: "select",
        label: "Brush shape",
        options: [
          {
            label: "Hand (fingers + filled palm)",
            value: "hand"
          },
          {
            label: "Capsule (along fingers)",
            value: "capsule"
          },
          {
            label: "Blobs (per joint)",
            value: "blobs"
          }
        ]
      },
      brushSize: {
        component: "slider",
        label: "Copied area (brush size)",
        min: 5,
        max: 240,
        step: 1
      },
      feather: {
        component: "slider",
        label: "Edge softness",
        min: 0,
        max: 1,
        step: 0.01
      },
      smoothing: {
        component: "slider",
        label: "Tracking smoothing",
        min: 0,
        max: 0.95,
        step: 0.01
      }
    }
  },

  echo: {
    component: "nested-object",
    label: "Echo",
    initialExpanded: true,
    fields: {
      layers: {
        component: "slider",
        label: "Echo layers (depth)",
        min: 2,
        max: 48,
        step: 1
      },
      spacing: {
        component: "slider",
        label: "Frames between copies",
        min: 1,
        max: 12,
        step: 1
      },
      offset: {
        component: "vector2d",
        label: "Layer offset (px)",
        min: -40,
        max: 40,
        step: 1,
        yDown: true
      },
      scaleStep: {
        component: "slider",
        label: "Layer growth",
        min: 0,
        max: 0.03,
        step: 0.001
      },
      rotateStep: {
        component: "slider",
        label: "Layer twist (°)",
        min: -2,
        max: 2,
        step: 0.1
      },
      minAlpha: {
        component: "slider",
        label: "Oldest layer opacity",
        min: 0,
        max: 255,
        step: 1
      },
      colorMix: {
        component: "slider",
        label: "Depth colour mix",
        min: 0,
        max: 1,
        step: 0.01
      },
      opacity: {
        component: "slider",
        label: "Echo opacity",
        min: 0,
        max: 1,
        step: 0.01
      },
      frontColor: {
        component: "color",
        label: "Front colour (newest)"
      },
      midColor: {
        component: "color",
        label: "Mid colour"
      },
      backColor: {
        component: "color",
        label: "Back colour (oldest)"
      }
    }
  },

  splines: {
    component: "nested-object",
    label: "Spline overlay",
    fields: {
      enabled: {
        component: "checkbox",
        label: "Draw splines on the hands"
      },
      weight: {
        component: "slider",
        label: "Weight",
        min: 1,
        max: 40,
        step: 0.5
      },
      glow: {
        component: "slider",
        label: "Glow layers",
        min: 0,
        max: 8,
        step: 1
      },
      gradient: {
        component: "checkbox",
        label: "Rainbow gradient along path"
      },
      hueSpeed: {
        component: "slider",
        label: "Hue speed (over time)",
        min: 0,
        max: 5,
        step: 0.1
      },
      hueSpread: {
        component: "slider",
        label: "Hue spread along path",
        min: 0,
        max: 8,
        step: 0.05
      },
      iterations: {
        component: "slider",
        label: "Chaikin iterations",
        min: 0,
        max: 6,
        step: 1
      }
    }
  },

  performance: {
    component: "nested-object",
    label: "Performance",
    fields: {
      bufferScale: {
        component: "slider",
        label: "Buffer scale",
        min: 0.2,
        max: 1,
        step: 0.05
      }
    }
  }
};
