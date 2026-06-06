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
  show: {
    polygon: true,
    points: true
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
  show: {
    label: "Demonstration overlay",
    component: "nested-object",
    fields: {
      polygon: {
        label: "Show raw polygon",
        component: "checkbox"
      },
      points: {
        label: "Show points",
        component: "checkbox"
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
