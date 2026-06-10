import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

export const formValues = {
  mode: {
    type: "live" as "live" | "trail",
    smoothing: 0.35,
    maxPoints: 90,
    minDistance: 6
  },

  // A virtual orbit source is on by default so the sketch animates immediately
  // (and previews) without a webcam or a camera-permission prompt. Vision is
  // armed but starts OFF — the Fingers tracker is pre-enabled, so flipping
  // Vision → Enabled immediately lets each finger trace its own line (use
  // trail mode to draw in the air with your fingertips). Hands / Body / Face
  // can be toggled too; the hand landmarks are pre-set for a fingertip fan.
  interaction: {
    ...interactionFormValues,
    vision: {
      ...interactionFormValues.vision,
      enabled: false,
      hands: {
        ...interactionFormValues.vision.hands,
        landmarks: {
          fingertips: true,
          palm: true
        }
      },
      fingers: {
        ...interactionFormValues.vision.fingers,
        enabled: true
      }
    },
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false,
      count: 6
    }
  },

  curve: {
    method: "chaikin" as "chaikin" | "catmull-rom" | "quadratic",
    iterations: 6,
    closed: false,
    tension: 5
  },

  stroke: {
    weight: 19.5,
    glow: 2,
    hueSpeed: 1.5,
    gradient: true
  },

  overlay: {
    polygon: {
      show: false,
      weight: 2,
      color: [
        255,
        255,
        255,
        90
      ] as number[],
      dashed: true,
      dash: 14,
      gap: 10
    },
    points: {
      show: false,
      size: 16,
      coreRatio: 0.5,
      color: [
        255,
        255,
        255,
        255
      ] as number[],
      coreColor: [
        10,
        10,
        14,
        255
      ] as number[]
    }
  },

  backgroundColor: [
    0,
    0,
    0,
    255
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  mode: {
    label: "Mode",
    component: "nested-object",
    fields: {
      type: {
        label: "Drawing mode",
        component: "select",
        options: [
          {
            label: "Live (spline through each entity)",
            value: "live"
          },
          {
            label: "Trail (draw in the air)",
            value: "trail"
          }
        ]
      },
      smoothing: {
        label: "Smoothing (anti-jitter)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.05
      },
      maxPoints: {
        label: "Trail length (points)",
        component: "slider",
        min: 10,
        max: 300,
        step: 5
      },
      minDistance: {
        label: "Trail point spacing (px)",
        component: "slider",
        min: 0,
        max: 40,
        step: 1
      }
    }
  },

  interaction: interactionFormConfiguration,

  curve: {
    label: "Curve",
    component: "nested-object",
    fields: {
      method: {
        label: "Rounding method",
        component: "select",
        options: [
          {
            label: "Chaikin (corner-cutting)",
            value: "chaikin"
          },
          {
            label: "Catmull-Rom (curveVertex)",
            value: "catmull-rom"
          },
          {
            label: "Quadratic (midpoints)",
            value: "quadratic"
          }
        ]
      },
      iterations: {
        label: "Chaikin iterations",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      closed: {
        label: "Closed loop?",
        component: "checkbox"
      },
      tension: {
        label: "Catmull-Rom tension",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      }
    }
  },

  stroke: {
    label: "Stroke",
    component: "nested-object",
    fields: {
      weight: {
        label: "Weight",
        component: "slider",
        min: 1,
        max: 40,
        step: 0.5
      },
      glow: {
        label: "Glow layers",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      hueSpeed: {
        label: "Hue speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      gradient: {
        label: "Gradient along path (Chaikin only)",
        component: "checkbox"
      }
    }
  },

  overlay: {
    label: "Demonstration overlay (live mode)",
    component: "nested-object",
    fields: {
      polygon: {
        label: "Raw polygon",
        component: "nested-object",
        fields: {
          show: {
            label: "Show raw polygon",
            component: "checkbox"
          },
          weight: {
            label: "Weight",
            component: "slider",
            min: 0.5,
            max: 12,
            step: 0.5
          },
          color: {
            label: "Color",
            component: "color"
          },
          dashed: {
            label: "Dashed?",
            component: "checkbox"
          },
          dash: {
            label: "Dash length",
            component: "slider",
            min: 1,
            max: 80,
            step: 1
          },
          gap: {
            label: "Gap length",
            component: "slider",
            min: 0,
            max: 80,
            step: 1
          }
        }
      },
      points: {
        label: "Points",
        component: "nested-object",
        fields: {
          show: {
            label: "Show points",
            component: "checkbox"
          },
          size: {
            label: "Size (diameter)",
            component: "slider",
            min: 0,
            max: 60,
            step: 0.5
          },
          coreRatio: {
            label: "Inner core ratio",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.02
          },
          color: {
            label: "Color",
            component: "color"
          },
          coreColor: {
            label: "Inner core color",
            component: "color"
          }
        }
      }
    }
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
