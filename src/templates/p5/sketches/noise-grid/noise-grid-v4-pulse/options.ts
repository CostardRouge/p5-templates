import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  grid: {
    rows: 40,
    columns: 40
  },
  noise: {
    seed: 42,
    detail: 4,
    falloff: 0.5,
    yTimeMultiplier: 0.2,
    zSpeed: 0.05
  },
  angle: {
    cycles: 4
  },
  pulse: {
    values: [
      0.75,
      1,
      1.25
    ],
    speed: 2,
    lerp: 0.07
  },
  holes: {
    thresholdMultiplier: 0.5,
    strokeWeight: 2
  },
  colors: {
    hueRange: Math.PI / 2,
    hueOffset: 0,
    opacityMax: 3,
    opacityMin: 1
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
      lerp: {
        label: "Pulse smoothing",
        component: "slider",
        min: 0.01,
        max: 0.5,
        step: 0.01
      }
    }
  },
  holes: {
    component: "nested-object",
    label: "Holes",
    fields: {
      thresholdMultiplier: {
        label: "Hole threshold × max",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      strokeWeight: {
        label: "Hole stroke weight",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
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
  },
  title: titleFormConfiguration
};
