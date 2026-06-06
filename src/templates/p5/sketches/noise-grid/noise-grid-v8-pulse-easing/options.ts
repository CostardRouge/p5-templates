import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  grid: {
    rows: 189,
    columns: 190
  },
  noise: {
    seed: 2785,
    detailLod: 1,
    yTimeMultiplier: 1.28,
    zTimeMultiplier: 2
  },
  angle: {
    cycles: 10.3
  },
  pulse: {
    speed: 10
  },
  stroke: {
    weightEasing: "easeOutSine",
    weightMin: 2.5,
    weightMax: 3
  },
  colors: {
    hueRange: 2.77,
    hueOffset: 3.13840734641021,
    opacityFactor: 2
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
      detailLod: {
        label: "Detail (octaves)",
        component: "slider",
        min: 1,
        max: 32,
        step: 1
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
