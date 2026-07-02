import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  grid: {
    rows: 137,
    columns: 147
  },
  noise: {
    seed: 42,
    detail: 4,
    falloff: 0.59
  },
  offsets: {
    xSpeed: 0.08,
    ySpeed: 0.95,
    zSpeed: 0.5,
    xRangeDivisor: 0.5,
    yRangeDivisor: 1.4,
    zRangeDivisor: 0.5
  },
  angle: {
    cycles: 7
  },
  stroke: {
    weightEasing: "easeInOutExpo",
    weightMin: 7,
    weightMaxScale: 0.35
  },
  translation: {
    xMultiplier: 1,
    yMultiplier: 1
  },
  colors: {
    hueRange: Math.PI / 2,
    hueOffset: 0,
    opacityFactor: 1.5
  },
  backgroundColor: [
    0,
    0,
    0
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
      }
    }
  },
  offsets: {
    component: "nested-object",
    label: "Animated offsets",
    fields: {
      xSpeed: {
        label: "X speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      },
      ySpeed: {
        label: "Y speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      },
      zSpeed: {
        label: "Z speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      },
      xRangeDivisor: {
        label: "X range divisor",
        component: "slider",
        min: 0.5,
        max: 10,
        step: 0.1
      },
      yRangeDivisor: {
        label: "Y range divisor",
        component: "slider",
        min: 0.5,
        max: 10,
        step: 0.1
      },
      zRangeDivisor: {
        label: "Z range divisor",
        component: "slider",
        min: 0.5,
        max: 10,
        step: 0.1
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
        max: 200,
        step: 1
      },
      weightMaxScale: {
        label: "Weight max scale (× cell size)",
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
  },
  title: titleFormConfiguration
};
