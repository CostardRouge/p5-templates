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
    rows: 352,
    columns: 18
  },
  noise: {
    seed: 0,
    detail: 1,
    falloff: 0.27,
    xMultiplier: 0.03,
    yMultiplier: 0.48,
    timeYMultiplier: -0.84,
    timeZMultiplier: -0.33
  },
  angle: {
    cycles: 6
  },
  displacement: {
    zScale: 19.8
  },
  stroke: {
    weightMin: 83.5,
    weightMax: 39
  },
  colors: {
    paletteA: "rainbow",
    paletteB: "rainbow",
    paletteSwitchSpeed: 0,
    opacityMax: 1.9,
    opacityMin: 0.8,
    opacityEasing: "linear",
    hueIndexMultiplier: 1.1,
    hueIndexEasing: "easeOutQuad",
    hueOffset: -2.10159265358979
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
      timeYMultiplier: {
        label: "Time scroll (Y)",
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
      hueIndexMultiplier: {
        label: "Hue index multiplier",
        component: "slider",
        min: 0,
        max: 16,
        step: 0.1
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
