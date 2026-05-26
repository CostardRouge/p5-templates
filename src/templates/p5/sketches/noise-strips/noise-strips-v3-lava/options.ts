import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

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
    rows: 136,
    columns: 101
  },
  noise: {
    seed: 42,
    detail: 1,
    falloff: 0,
    xMultiplier: 0.55,
    yMultiplier: 0.82,
    timeXMultiplier: 0.1
  },
  angle: {
    cycles: 7
  },
  displacement: {
    zScale: 10,
    yScale: 2
  },
  motion: {
    enabled: true,
    speedX: 0.5,
    speedZ: 0.5
  },
  stroke: {
    weightMin: 46.5,
    weightMax: 10
  },
  colors: {
    paletteA: "rainbow",
    paletteB: "purple",
    paletteSwitchSpeed: 0,
    noiseScale: 1,
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
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
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
      speedZ: {
        label: "Z drift speed",
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
      yScale: {
        label: "Y stretch",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
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
      noiseScale: {
        label: "Lava noise scale",
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
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
