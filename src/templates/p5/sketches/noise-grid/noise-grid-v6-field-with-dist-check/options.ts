import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  grid: {
    rows: 211,
    columns: 202
  },
  noise: {
    seed: 2094,
    detail: 14,
    falloff: 0.4,
    xTimeMultiplier: 0.25,
    yTimeMultiplier: 0.125,
    zTimeMultiplier: 0.16
  },
  angle: {
    cycles: 7.4
  },
  distance: {
    falloffEasing: "easeOutQuart",
    waveEasing: "easeInOutQuad",
    waveMin: 0.51,
    waveMax: 0.22,
    waveSpeed: 0
  },
  colors: {
    hueRange: 1.54,
    hueOffset: 1.58840734641021,
    opacityMax: 12.6,
    opacityMin: 1.3
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
      waveMin: {
        label: "Wave min (× width)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      waveMax: {
        label: "Wave max (× width)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
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
        label: "Opacity max (center)",
        component: "slider",
        min: 0.1,
        max: 300,
        step: 0.5
      },
      opacityMin: {
        label: "Opacity min (edges)",
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
