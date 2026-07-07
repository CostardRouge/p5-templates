export const formValues = {
  points: {
    count: 11,
    seed: 2,
    layout: "random" as "random" | "corners" | "ring",
    motion: 0.095,
    speed: 1,
    scale: 1
  },
  curve: {
    method: "chaikin" as "chaikin" | "catmull-rom" | "quadratic",
    iterations: 6,
    closed: true,
    tension: 1.5
  },
  stroke: {
    weight: 27,
    glow: 2,
    // Variable thickness profile: 0..2 multipliers on `weight` at each end of the
    // (open) spline with an easing for the transition. Both at 1 = uniform tube.
    // Only applies to open curves — a closed loop has no start/end to taper.
    weightStart: 1,
    weightEnd: 1,
    weightEasing: "linear",
    hueSpeed: 2,
    // Colour spread along the curve: hueSpread scales how many rainbow cycles
    // fit between the ends, hueOffset shifts the starting colour and hueEasing
    // reshapes the distribution so the user can move the colour density toward
    // either tip. Default = one cycle spread evenly across the curve.
    hueSpread: 1,
    hueOffset: 0,
    hueEasing: "linear",
    gradient: true
  },
  overlay: {
    polygon: {
      show: true,
      weight: 4.5,
      color: [
        255,
        255,
        255,
        181
      ] as number[],
      dashed: true,
      dash: 17,
      gap: 10
    },
    points: {
      show: true,
      size: 38.5,
      coreRatio: 0.88,
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
        label: "Count (ignored for corners)",
        component: "slider",
        min: 3,
        max: 24,
        step: 1
      },
      seed: {
        label: "Random seed",
        component: "slider",
        min: 0,
        max: 100,
        step: 1
      },
      layout: {
        label: "Layout",
        component: "select",
        options: [
          {
            label: "Random",
            value: "random"
          },
          {
            label: "Corners (4)",
            value: "corners"
          },
          {
            label: "Ring",
            value: "ring"
          }
        ]
      },
      motion: {
        label: "Motion amount",
        component: "slider",
        min: 0,
        max: 0.25,
        step: 0.005
      },
      speed: {
        label: "Motion speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      scale: {
        label: "Scale (general size)",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.05
      }
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
