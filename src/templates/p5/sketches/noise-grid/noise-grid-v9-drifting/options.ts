import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  grid: {
    rows: 135,
    columns: 216
  },
  noise: {
    seed: 0,
    detailLod: 37
  },
  detail: {
    values: [
      0.2,
      0.3,
      0.4,
      0.5
    ],
    lerp: 0.01
  },
  drift: {
    xSpeedValues: [
      -0.01,
      0.01
    ],
    ySpeedValues: [
      -0.01,
      0.01
    ],
    lerp: 0.04
  },
  angle: {
    cycles: 2.8
  },
  stroke: {
    weightEasing: "easeInOutQuart",
    weightMin: 0,
    weightMaxScale: 0.7
  },
  translation: {
    xMultiplier: -0.65,
    yMultiplier: 1
  },
  colors: {
    hueMax: 3.14,
    hueOffset: 0,
    opacityFactor: 1.5
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
        label: "Detail LOD",
        component: "slider",
        min: 1,
        max: 256,
        step: 1
      }
    }
  },
  detail: {
    component: "nested-object",
    label: "Detail sequence (falloff)",
    fields: {
      lerp: {
        label: "Lerp",
        component: "slider",
        min: 0.01,
        max: 0.5,
        step: 0.01
      }
    }
  },
  drift: {
    component: "nested-object",
    label: "Drift",
    fields: {
      lerp: {
        label: "Drift lerp",
        component: "slider",
        min: 0.01,
        max: 0.5,
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
  stroke: {
    component: "nested-object",
    label: "Stroke",
    fields: {
      weightEasing: {
        component: "easing",
        label: "Weight easing"
      },
      weightMin: {
        label: "Weight min",
        component: "slider",
        min: 0,
        max: 100,
        step: 0.5
      },
      weightMaxScale: {
        label: "Weight max scale × cell",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      }
    }
  },
  translation: {
    component: "nested-object",
    label: "Translation",
    fields: {
      xMultiplier: {
        label: "X multiplier",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      },
      yMultiplier: {
        label: "Y multiplier",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      hueMax: {
        label: "Hue max",
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
  },
  title: titleFormConfiguration
};
