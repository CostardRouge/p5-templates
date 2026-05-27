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
    xTimeMultiplier: 0.25,
    yTimeMultiplier: 0.125,
    zTimeMultiplier: 0.16
  },
  angle: {
    cycles: 4
  },
  distance: {
    falloffEasing: "easeInQuad",
    waveEasing: "easeOutQuad",
    waveMin: 0.5,
    waveMax: 1,
    waveSpeed: 1
  },
  colors: {
    hueRange: Math.PI / 4,
    hueOffset: 0,
    opacityMax: 100,
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
