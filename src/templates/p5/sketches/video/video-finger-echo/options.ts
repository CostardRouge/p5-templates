import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Default values only — exposed at runtime as `options.sketch.*`
export const formValues = {
  // Source + tracking. Same block as splines-v1-interactive: switch Vision →
  // Source between the webcam and a recorded video / image asset (the same
  // footage drives both the picture AND the inference). Fingers tracking is on
  // by default; turn on Hands for a fuller palm cutout.
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

  // The picture behind the trail.
  display: {
    backgroundColor: [
      8,
      8,
      10
    ],
    showVideo: true,
    videoOpacity: 1
  },

  // Which part of the hand is cut out of the footage, and how soft the cut is.
  mask: {
    region: "vision",
    shape: "capsule",
    brushSize: 45,
    feather: 0.6,
    smoothing: 0.3
  },

  // How the cutout trail ages: how long it lingers, whether it drifts, and an
  // optional colour it bleeds toward as it fades.
  echo: {
    decay: 0.92,
    mode: "fade",
    amount: 8,
    grow: 0.02,
    opacity: 1,
    tintColor: [
      120,
      0,
      255
    ],
    tintAmount: 0
  },

  // Trail/mask buffers render at this fraction of the canvas — lower is faster.
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
    label: "Finger mask",
    initialExpanded: true,
    fields: {
      region: {
        component: "select",
        label: "Masked source",
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
        label: "Brush size",
        min: 5,
        max: 200,
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
      decay: {
        component: "slider",
        label: "Trail length (decay)",
        min: 0,
        max: 0.99,
        step: 0.01
      },
      mode: {
        component: "select",
        label: "Drift",
        options: [
          {
            label: "Fade in place",
            value: "fade"
          },
          {
            label: "Follow motion",
            value: "motion"
          },
          {
            label: "Up",
            value: "up"
          },
          {
            label: "Down",
            value: "down"
          },
          {
            label: "Left",
            value: "left"
          },
          {
            label: "Right",
            value: "right"
          },
          {
            label: "Grow",
            value: "grow"
          }
        ]
      },
      amount: {
        component: "slider",
        label: "Drift amount",
        min: 0,
        max: 40,
        step: 1
      },
      grow: {
        component: "slider",
        label: "Grow step",
        min: 0,
        max: 0.1,
        step: 0.005
      },
      opacity: {
        component: "slider",
        label: "Trail opacity",
        min: 0,
        max: 1,
        step: 0.01
      },
      tintColor: {
        component: "color",
        label: "Age tint color"
      },
      tintAmount: {
        component: "slider",
        label: "Age tint amount",
        min: 0,
        max: 0.5,
        step: 0.01
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
