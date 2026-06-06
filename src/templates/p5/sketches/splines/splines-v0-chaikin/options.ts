export const formValues = {
  points: {
    count: 6,
    seed: 1,
    layout: "random" as "random" | "corners" | "ring",
    motion: 0.05,
    speed: 1
  },
  curve: {
    method: "chaikin" as "chaikin" | "catmull-rom" | "quadratic",
    iterations: 4,
    closed: true,
    tension: 0
  },
  stroke: {
    weight: 6,
    glow: 3,
    hueSpeed: 1,
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
        70
      ] as number[],
      dashed: false,
      dash: 18,
      gap: 12
    },
    points: {
      show: true,
      size: 14,
      coreRatio: 0.36,
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
