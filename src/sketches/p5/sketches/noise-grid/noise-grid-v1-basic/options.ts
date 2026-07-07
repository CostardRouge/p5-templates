
const PALETTE_OPTIONS = [
  {
    label: "Rainbow",
    value: "rainbow"
  },
  {
    label: "Rainbow Crazy",
    value: "rainbowCrazy"
  },
  {
    label: "Purple",
    value: "purple"
  },
  {
    label: "Dark Blue Yellow",
    value: "darkBlueYellow"
  },
  {
    label: "Black",
    value: "black"
  },
  {
    label: "Green",
    value: "green"
  }
];

export const formValues = {
  grid: {
    rows: 189,
    columns: 119
  },
  noise: {
    seed: 6636,
    detail: 4,
    falloff: 0.61,
    xMultiplier: 1.34,
    yMultiplier: 2.08,
    timeXMultiplier: -1,
    timeYMultiplier: 0.2,
    timeZMultiplier: 0.22
  },
  angle: {
    cycles: 11.6
  },
  displacement: {
    zScale: 0
  },
  translation: {
    scale: 0.96,
    yMultiplier: -2.03
  },
  stroke: {
    weightMin: 25,
    weightMax: 50
  },
  colors: {
    paletteA: "rainbow",
    paletteB: "purple",
    paletteIndex: 0,
    hueOffset: 0,
    opacityMin: 1,
    opacityMax: 3,
    precisionValues: [
      0.1,
      0.5,
      1,
      2
    ]
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
        max: 500,
        step: 1
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 500,
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
      xMultiplier: {
        label: "X multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      yMultiplier: {
        label: "Y multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      timeXMultiplier: {
        label: "Time → X drift",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      timeYMultiplier: {
        label: "Time → Y drift",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      timeZMultiplier: {
        label: "Time → Z drift",
        component: "slider",
        min: -5,
        max: 5,
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
  displacement: {
    component: "nested-object",
    label: "Displacement",
    fields: {
      zScale: {
        label: "Z scale",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.1
      }
    }
  },
  translation: {
    component: "nested-object",
    label: "Translation",
    fields: {
      scale: {
        label: "Stroke scale",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      },
      yMultiplier: {
        label: "Y multiplier",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      }
    }
  },
  stroke: {
    component: "nested-object",
    label: "Stroke weight",
    fields: {
      weightMin: {
        label: "Min weight",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      weightMax: {
        label: "Max weight",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      paletteA: {
        label: "Palette A",
        component: "select",
        options: PALETTE_OPTIONS
      },
      paletteB: {
        label: "Palette B",
        component: "select",
        options: PALETTE_OPTIONS
      },
      paletteIndex: {
        label: "Active palette",
        component: "slider",
        min: 0,
        max: 1,
        step: 1
      },
      hueOffset: {
        label: "Hue offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      opacityMin: {
        label: "Opacity min",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      },
      opacityMax: {
        label: "Opacity max",
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
