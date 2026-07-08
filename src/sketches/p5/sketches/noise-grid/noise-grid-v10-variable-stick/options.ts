
export const formValues = {
  grid: {
    rows: 95,
    columns: 102
  },
  noise: {
    seed: 0,
    detail: 1,
    falloff: 1,
    yTimeMultiplier: -0.24,
    zSpeed: 0.265
  },
  angle: {
    cycles: 2.6
  },
  stick: {
    strokeWeight: 1,
    lengthMin: 14,
    lengthMax: 214.5,
    lengthSpeed: 2
  },
  colors: {
    hueEasing: "easeOutQuad",
    hueRange: 1.93,
    hueOffset: 0.098407346410207,
    opacityFactor: 1.5
  },
  backgroundColor: [
    0,
    0,
    0
  ]
};

export const formConfiguration: Record<string, any> = {
  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      }
    }
  },
  noise: {
    component: "nested-object",
    label: "Noise",
    fields: {
      seed: {
        label: "Seed",
        component: "slider",
        min: 0,
        max: 9999,
        step: 1
      },
      detail: {
        label: "Detail (octaves)",
        component: "slider",
        min: 1,
        max: 32,
        step: 1
      },
      falloff: {
        label: "Falloff",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      yTimeMultiplier: {
        label: "Y time multiplier",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      zSpeed: {
        label: "Z speed",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.001
      }
    }
  },
  angle: {
    component: "nested-object",
    label: "Angle",
    fields: {
      cycles: {
        label: "Angle cycles",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      }
    }
  },
  stick: {
    component: "nested-object",
    label: "Stick",
    fields: {
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 1,
        max: 80,
        step: 0.5
      },
      lengthMin: {
        label: "Length min",
        component: "slider",
        min: 0,
        max: 300,
        step: 0.5
      },
      lengthMax: {
        label: "Length max",
        component: "slider",
        min: 0,
        max: 300,
        step: 0.5
      },
      lengthSpeed: {
        label: "Length pulse speed",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      hueEasing: {
        component: "easing",
        label: "Hue easing"
      },
      hueRange: {
        label: "Hue range",
        component: "slider",
        min: 0,
        max: Math.PI,
        step: 0.01
      },
      hueOffset: {
        label: "Hue offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      opacityFactor: {
        label: "Opacity factor",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
