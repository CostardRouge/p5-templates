import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  grid: {
    columns: 40,
    rows: 40,
    proportional: true
  },
  noise: {
    seed: 42,
    detailLod: 6,
    detailFalloff: 0.6,
    threshold: 0.5,
    speed: 0.05
  },
  gridLines: {
    weight: 1
  },
  cross: {
    sizeMultiplier: 0.5,
    strokeWeight: 2
  },
  colors: {
    palettes: [
      {
        primary: [
          255,
          0,
          64
        ],
        secondary: [
          0,
          255,
          192
        ]
      },
      {
        primary: [
          0,
          255,
          192
        ],
        secondary: [
          255,
          0,
          64
        ]
      }
    ],
    intermediary: [
      255,
      255,
      255
    ],
    paletteSpeed: 0.5
  },
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
      columns: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      proportional: {
        label: "Proportional?",
        component: "checkbox"
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
      detailFalloff: {
        label: "Detail falloff",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      threshold: {
        label: "Cross threshold",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      speed: {
        label: "Speed",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.001
      }
    }
  },
  gridLines: {
    component: "nested-object",
    label: "Grid lines",
    fields: {
      weight: {
        label: "Line weight",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      }
    }
  },
  cross: {
    component: "nested-object",
    label: "Crosses",
    fields: {
      sizeMultiplier: {
        label: "Size × cell",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.1
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      paletteSpeed: {
        label: "Palette cycle speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      }
    }
  },
  title: titleFormConfiguration
};
