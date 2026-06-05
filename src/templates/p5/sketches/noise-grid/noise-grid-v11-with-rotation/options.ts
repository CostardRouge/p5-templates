import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  grid: {
    rows: 74,
    columns: 72
  },
  noise: {
    seed: 42,
    detail: 4,
    falloff: 0.3
  },
  angle: {
    cycles: 4
  },
  rotation: {
    angleMax: Math.PI / 2,
    speed: 1
  },
  stroke: {
    weight: 10
  },
  colors: {
    hueRange: Math.PI / 2,
    hueOffset: 0,
    opacityFactor: 1.5,
    precisionDigits: 3
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
  rotation: {
    component: "nested-object",
    label: "Scene rotation",
    fields: {
      angleMax: {
        label: "Max angle",
        component: "slider",
        min: 0,
        max: Math.PI,
        step: 0.01
      },
      speed: {
        label: "Speed",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      }
    }
  },
  stroke: {
    component: "nested-object",
    label: "Stroke",
    fields: {
      weight: {
        label: "Weight",
        component: "slider",
        min: 1,
        max: 60,
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
      },
      precisionDigits: {
        label: "Color cache precision",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
