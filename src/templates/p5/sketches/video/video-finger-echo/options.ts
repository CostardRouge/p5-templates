import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Default values only — exposed at runtime as `options.sketch.*`
export const formValues = {
  // Source + tracking. Same block as splines-v1-interactive: switch Vision →
  // Source between the webcam and a recorded video / image asset (the same
  // footage drives both the picture AND the inference). Fingers tracking is on
  // by default; turn on Hands for a fuller palm fan.
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

  // The picture behind the glowing trail.
  display: {
    backgroundColor: [
      8,
      8,
      10
    ],
    showVideo: true,
    videoOpacity: 1
  },

  // Which detected entities become splines, and how calm the tracking is.
  hand: {
    region: "vision",
    smoothing: 0.35
  },

  // The glowing spline look (GPU shader pipeline, like splines-v1-interactive).
  stroke: {
    weight: 16,
    glow: 2,
    gradient: true,
    hueSpeed: 1.5,
    hueSpread: 2
  },

  // Chaikin rounding of the finger/hand chains.
  curve: {
    iterations: 5,
    closed: false
  },

  // How the glowing trail ages: how long it lingers, whether it drifts, and an
  // optional colour it bleeds toward as it fades.
  echo: {
    decay: 0.9,
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

  hand: {
    component: "nested-object",
    label: "Hand",
    initialExpanded: true,
    fields: {
      region: {
        component: "select",
        label: "Drawn source",
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
      smoothing: {
        component: "slider",
        label: "Tracking smoothing",
        min: 0,
        max: 0.95,
        step: 0.01
      }
    }
  },

  stroke: {
    component: "nested-object",
    label: "Stroke",
    initialExpanded: true,
    fields: {
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
      }
    }
  },

  curve: {
    component: "nested-object",
    label: "Curve",
    fields: {
      iterations: {
        component: "slider",
        label: "Chaikin iterations",
        min: 0,
        max: 6,
        step: 1
      },
      closed: {
        component: "checkbox",
        label: "Closed loop?"
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
  }
};
