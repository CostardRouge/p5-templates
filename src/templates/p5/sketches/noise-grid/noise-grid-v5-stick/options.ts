import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  grid: {
    rows: 94,
    columns: 90
  },
  noise: {
    seed: 4572,
    detail: 1,
    falloff: 0,
    yTimeMultiplier: -0.82,
    zSpeed: 0.348
  },
  angle: {
    cycles: 3.7
  },
  stick: {
    lengthScaleMin: 2.14,
    lengthScaleMax: 5,
    strokeWeight: 3.5
  },
  colors: {
    hueRange: 2.59,
    hueOffset: -1.46159265358979,
    opacityMax: 3.2,
    opacityMin: 0.1
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
  stick: {
    component: "nested-object",
    label: "Stick",
    fields: {
      lengthScaleMin: {
        label: "Min length × cell",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      lengthScaleMax: {
        label: "Max length × cell",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 1,
        max: 80,
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
