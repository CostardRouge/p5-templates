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
    yTimeMultiplier: 0.125,
    zSpeed: 0.05
  },
  angle: {
    cycles: 4
  },
  stick: {
    strokeWeight: 15,
    lengthMin: 5,
    lengthMax: 50,
    lengthSpeed: 1
  },
  colors: {
    hueEasing: "easeOutBack",
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
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 1,
        max: 80,
        step: 0.5
      },
      lengthMin: {
        label: "Length min",
        component: "slider",
        min: 0,
        max: 300,
        step: 0.5
      },
      lengthMax: {
        label: "Length max",
        component: "slider",
        min: 0,
        max: 300,
        step: 0.5
      },
      lengthSpeed: {
        label: "Length pulse speed",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      hueEasing: {
        component: "easing",
        label: "Hue easing"
      },
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
