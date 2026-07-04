
const PALETTE_OPTIONS = [
  {
    label: "Rainbow",
    value: "rainbow"
  },
  {
    label: "Rainbow crazy",
    value: "rainbowCrazy"
  },
  {
    label: "Purple",
    value: "purple"
  },
  {
    label: "Dark blue / yellow",
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
    rows: 24,
    columns: 202
  },
  noise: {
    seed: 42,
    detail: 2,
    falloff: 0.59,
    xMultiplier: 0.43,
    yMultiplier: 0.04,
    timeXMultiplier: 0.2,
    timeZMultiplier: 0.1
  },
  angle: {
    cycles: 4
  },
  displacement: {
    zScale: 10,
    yPatternSpeed: 0.5
  },
  motion: {
    enabled: true,
    speedX: 0.77,
    speedY: 0.33
  },
  stroke: {
    weightMin: 84,
    weightMax: 35
  },
  colors: {
    paletteA: "rainbow",
    paletteB: "green",
    paletteSwitchSpeed: 0,
    precisionSpeed: 1,
    opacityMax: 3,
    opacityMin: 1,
    opacityEasing: "linear",
    hueIndexEasing: "linear",
    hueOffset: 0
  },
  backgroundColor: [
    0,
    0,
    0,
    255
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
        max: 600,
        step: 1
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 600,
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
        max: 8,
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
        label: "X scale",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      yMultiplier: {
        label: "Y scale",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      timeXMultiplier: {
        label: "Time scroll (X)",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      timeZMultiplier: {
        label: "Time scroll (Z)",
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
        label: "TAU cycles",
        component: "slider",
        min: 1,
        max: 16,
        step: 1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Drift motion",
    fields: {
      enabled: {
        label: "Animated drift?",
        component: "checkbox"
      },
      speedX: {
        label: "X drift speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      speedY: {
        label: "Y drift speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      }
    }
  },
  displacement: {
    component: "nested-object",
    label: "Displacement",
    fields: {
      zScale: {
        label: "Z amplitude (× cell)",
        component: "slider",
        min: 0,
        max: 80,
        step: 0.1
      },
      yPatternSpeed: {
        label: "Y warp pattern speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      }
    }
  },
  stroke: {
    component: "nested-object",
    label: "Stroke",
    fields: {
      weightMin: {
        label: "Weight min",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.5
      },
      weightMax: {
        label: "Weight max",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.5
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
      paletteSwitchSpeed: {
        label: "Palette swap speed",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      precisionSpeed: {
        label: "Hue precision speed",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      opacityMin: {
        label: "Opacity min",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      opacityEasing: {
        component: "easing",
        label: "Opacity easing"
      },
      hueIndexEasing: {
        component: "easing",
        label: "Hue index easing"
      },
      hueOffset: {
        label: "Hue offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
