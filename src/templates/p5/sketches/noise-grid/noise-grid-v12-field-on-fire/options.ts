import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  grid: {
    rows: 96,
    columns: 96
  },
  noise: {
    seed: 0,
    detailLod: 1,
    detailFalloff: 0,
    xTimeMultiplier: 0.25,
    yTimeMultiplier: 0.125,
    zTimeMultiplier: 0.05
  },
  angle: {
    cycles: 4
  },
  displacement: {
    zScale: 18.8
  },
  distance: {
    falloffEasing: "easeOutQuad",
    waveEasing: "easeOutQuad",
    waveSpeed: 1
  },
  colors: {
    hueOffsetSpeed: 1,
    hueIndexMultiplier: 2,
    opacityMax: 10,
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
      detailFalloff: {
        label: "Detail falloff",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      xTimeMultiplier: {
        label: "X time multiplier",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
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
  displacement: {
    component: "nested-object",
    label: "Displacement",
    fields: {
      zScale: {
        label: "Z scale",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.1
      }
    }
  },
  distance: {
    component: "nested-object",
    label: "Distance falloff",
    fields: {
      falloffEasing: {
        component: "easing",
        label: "Falloff easing"
      },
      waveEasing: {
        component: "easing",
        label: "Wave easing"
      },
      waveSpeed: {
        label: "Wave speed",
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
      hueOffsetSpeed: {
        label: "Hue offset speed",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      },
      hueIndexMultiplier: {
        label: "Hue index multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 0.1,
        max: 50,
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
