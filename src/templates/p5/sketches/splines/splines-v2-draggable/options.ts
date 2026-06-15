import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Same control-point-free spline look as v0, but the points are an editable,
// PERSISTED list (normalized 0..1 so they survive canvas resizes and are
// saved/exported with the template). They are random by default (seeded) and
// can be moved interactively — with the mouse or a finger — or edited by hand
// in the form. Dragging a point never pans/zooms the viewport: the touchscreen
// is claimed by enabling `interaction.touch` (TemplateSketchPage flips the
// viewport's disableTouchGestures), and the mouse drag is kept off the pan by
// tagging the canvas with `data-no-drag` while a point is under the cursor.
export const formValues = {
  points: {
    count: 9,
    seed: 15,
    // Normalized [0..1] control points. Drag on the canvas updates these; the
    // form's list edits them too. `count` / `seed` only regenerate the random
    // layout (overwriting the list) when either changes.
    items: [
      {
        x: 0.50,
        y: 0.13
      },
      {
        x: 0.74,
        y: 0.21
      },
      {
        x: 0.88,
        y: 0.43
      },
      {
        x: 0.83,
        y: 0.69
      },
      {
        x: 0.63,
        y: 0.87
      },
      {
        x: 0.40,
        y: 0.88
      },
      {
        x: 0.20,
        y: 0.71
      },
      {
        x: 0.12,
        y: 0.45
      },
      {
        x: 0.28,
        y: 0.21
      }
    ] as Array<{ x: number;
      y: number }>
  },

  grab: {
    // Pick-up radius (px) around a point: a press/touch/pinch within it grabs it.
    radius: 44,
    // Camera pinch: the thumb and index tips must be closer than this (px) to
    // count as "pressed". Released at 1.6× this (hysteresis).
    pinch: 70,
    // EMA lag on the pinch midpoint to calm jittery hand landmarks (0 = none,
    // higher = smoother but laggier). Mouse / touch stay unsmoothed.
    cameraSmoothing: 0.4
  },

  // Mouse + touch + camera drive the dragging. Touch MUST stay enabled so the
  // viewport hands the touchscreen to the sketch instead of panning. Vision is
  // armed (Hands pre-selected for the pinch) but starts OFF — flip Vision →
  // Enabled to grab points by pinching thumb + index.
  interaction: {
    ...interactionFormValues,
    mouse: {
      ...interactionFormValues.mouse,
      enabled: true
    },
    touch: {
      ...interactionFormValues.touch,
      enabled: true
    },
    vision: {
      ...interactionFormValues.vision,
      hands: {
        ...interactionFormValues.vision.hands,
        enabled: true,
        landmarks: {
          fingertips: true,
          palm: false
        }
      }
    },
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false
    },
    visualization: {
      ...interactionFormValues.visualization,
      enabled: false
    }
  },

  curve: {
    method: "chaikin" as "chaikin" | "catmull-rom" | "quadratic",
    iterations: 6,
    closed: true,
    tension: 0
  },

  stroke: {
    weight: 16,
    glow: 2,
    weightStart: 1,
    weightEnd: 1,
    weightEasing: "linear",
    hueSpeed: 1.5,
    hueSpread: 1,
    hueOffset: 0,
    hueEasing: "linear",
    gradient: true
  },

  overlay: {
    polygon: {
      show: true,
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
      show: true,
      size: 18,
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
  points: {
    label: "Points",
    component: "nested-object",
    fields: {
      count: {
        label: "Count (regenerates the layout)",
        component: "slider",
        min: 3,
        max: 24,
        step: 1
      },
      seed: {
        label: "Random seed (regenerates the layout)",
        component: "slider",
        min: 0,
        max: 100,
        step: 1
      },
      items: {
        label: "Control points (normalized 0..1)",
        component: "item-list",
        minItems: 3,
        maxItems: 64,
        itemConfig: {
          label: "Point",
          component: "vector2d",
          min: 0,
          max: 1,
          step: 0.001,
          yDown: true
        }
      }
    }
  },

  grab: {
    label: "Grab",
    component: "nested-object",
    fields: {
      radius: {
        label: "Pick-up radius (px)",
        component: "slider",
        min: 10,
        max: 120,
        step: 1
      },
      pinch: {
        label: "Camera pinch distance (px)",
        component: "slider",
        min: 20,
        max: 200,
        step: 1
      },
      cameraSmoothing: {
        label: "Camera smoothing",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.05
      }
    }
  },

  // Focused subset of the shared interaction form: only the modalities this
  // sketch reads (mouse, touch, camera). Keep Touch enabled so dragging works on
  // phones without the viewport stealing the gesture; enable Vision to pinch.
  interaction: {
    component: "nested-object",
    label: "Input sources",
    fields: {
      enabled: interactionFormConfiguration.fields.enabled,
      mouse: interactionFormConfiguration.fields.mouse,
      touch: interactionFormConfiguration.fields.touch,
      vision: interactionFormConfiguration.fields.vision
    }
  },

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
        label: "Weight (middle of the curve)",
        component: "slider",
        min: 1,
        max: 40,
        step: 0.5
      },
      weightStart: {
        label: "Weight × at start (open curves only)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      weightEnd: {
        label: "Weight × at end (open curves only)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      weightEasing: {
        label: "Weight taper easing",
        component: "easing"
      },
      glow: {
        label: "Glow layers",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      hueSpeed: {
        label: "Hue speed (over time)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      hueSpread: {
        label: "Hue spread along path (Chaikin only)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.05
      },
      hueOffset: {
        label: "Hue offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      hueEasing: {
        label: "Hue spread easing",
        component: "easing"
      },
      gradient: {
        label: "Gradient along path (Chaikin only)",
        component: "checkbox"
      }
    }
  },

  overlay: {
    label: "Demonstration overlay",
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
