import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3
  },
  rings: {
    angleSubdivisions: 14,
    shadowsCount: 30,
    shadowIndexStep: 0.05,
    radiusDivisorMin: 0.2,
    radiusDivisorMax: 5,
    weightMin: 20,
    weightMax: 75,
    shadowRotationRadians: 7
  },
  motion: {
    spinSpeed: 1,
    jitterAmount: 0.33
  },
  colors: {
    hueSpeed: 1,
    hueSpread: 1,
    huePhase: 0,
    depthHue: 1,
    saturation: 1,
    brightness: 1,
    opacityCurveSpeed: 5,
    opacityMin: 1,
    opacityMax: 15
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

// UI configuration only
export const formConfiguration: Record<string, any> = {
  layout: {
    component: "nested-object",
    label: "Layout",
    fields: {
      xCount: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      yCount: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      sizeDivisor: {
        label: "Cell size divisor",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.1
      }
    }
  },
  rings: {
    component: "nested-object",
    label: "Rings",
    fields: {
      angleSubdivisions: {
        label: "Angle subdivisions",
        component: "slider",
        min: 1,
        max: 64,
        step: 1
      },
      shadowsCount: {
        label: "Depth (shadows count)",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      shadowIndexStep: {
        label: "Shadow index step",
        component: "slider",
        min: 0.01,
        max: 0.5,
        step: 0.01
      },
      radiusDivisorMin: {
        label: "Radius divisor min",
        component: "slider",
        min: 0.05,
        max: 10,
        step: 0.05
      },
      radiusDivisorMax: {
        label: "Radius divisor max",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      },
      weightMin: {
        label: "Dot weight min",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      weightMax: {
        label: "Dot weight max",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      },
      shadowRotationRadians: {
        label: "Shadow rotation",
        component: "slider",
        min: -20,
        max: 20,
        step: 0.1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      spinSpeed: {
        label: "Spin speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      jitterAmount: {
        label: "Jitter amount",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      hueSpeed: {
        label: "Hue speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      huePhase: {
        label: "Hue phase",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      depthHue: {
        label: "Depth hue shift",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      saturation: {
        label: "Saturation",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      opacityCurveSpeed: {
        label: "Opacity curve speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      opacityMin: {
        label: "Opacity min",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.1
      },
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 0,
        max: 50,
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
