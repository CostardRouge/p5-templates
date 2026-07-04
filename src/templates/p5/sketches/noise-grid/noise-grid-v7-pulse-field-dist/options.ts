
export const formValues = {
  grid: {
    rows: 164,
    columns: 160
  },
  noise: {
    seed: 1714,
    detailLod: 13,
    falloffMin: 0.22,
    falloffMax: 0.48,
    xTimeMultiplier: 0.16,
    yTimeMultiplier: 0.33,
    zTimeMultiplier: 0.1
  },
  angle: {
    cycles: 7.8
  },
  pulse: {
    speed: 3.08,
    weightBoost: 1.16
  },
  colors: {
    hueRange: 1.5,
    hueOffset: -1.75159265358979,
    opacityMax: 2.1,
    opacityMin: 4.1
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
        max: 300,
        step: 1
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 300,
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
      detailLod: {
        label: "Detail (octaves)",
        component: "slider",
        min: 1,
        max: 32,
        step: 1
      },
      falloffMin: {
        label: "Falloff min (low pulse)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      falloffMax: {
        label: "Falloff max (high pulse)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      xTimeMultiplier: {
        label: "X time multiplier",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      yTimeMultiplier: {
        label: "Y time multiplier",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      zTimeMultiplier: {
        label: "Z time multiplier",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
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
  pulse: {
    component: "nested-object",
    label: "Pulse",
    fields: {
      speed: {
        label: "Pulse speed",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      weightBoost: {
        label: "Weight boost on pulse",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
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
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      },
      opacityMin: {
        label: "Opacity min",
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
