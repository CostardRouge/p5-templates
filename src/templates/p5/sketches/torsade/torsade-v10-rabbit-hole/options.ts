import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3
  },
  rings: {
    shadowsCount: 30,
    shadowIndexStep: 0.05,
    angleSubdivisions: 14,
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

export const formConfiguration: Record<string, any> = {
  layout: {
    component: "nested-object",
    label: "Layout",
    fields: {
      xCount: {
        label: "X count",
        component: "slider",
        min: 1,
        max: 10,
        step: 1
      },
      yCount: {
        label: "Y count",
        component: "slider",
        min: 1,
        max: 10,
        step: 1
      },
      sizeDivisor: {
        label: "Size divisor",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      }
    }
  },
  rings: {
    component: "nested-object",
    label: "Rings",
    fields: {
      shadowsCount: {
        label: "Shadows count",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      shadowIndexStep: {
        label: "Shadow step",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01
      },
      angleSubdivisions: {
        label: "Angle subdivisions",
        component: "slider",
        min: 2,
        max: 64,
        step: 1
      },
      radiusDivisorMin: {
        label: "Radius divisor min",
        component: "slider",
        min: 0.05,
        max: 5,
        step: 0.01
      },
      radiusDivisorMax: {
        label: "Radius divisor max",
        component: "slider",
        min: 0.5,
        max: 30,
        step: 0.1
      },
      weightMin: {
        label: "Weight min",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      weightMax: {
        label: "Weight max",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      shadowRotationRadians: {
        label: "Shadow rotation radians",
        component: "slider",
        min: 0,
        max: 30,
        step: 0.1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      spinSpeed: {
        label: "Spin speed",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      jitterAmount: {
        label: "Jitter amount",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      hueSpeed: {
        label: "Hue speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.01
      },
      opacityCurveSpeed: {
        label: "Opacity curve speed",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.1
      },
      opacityMin: {
        label: "Opacity min",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
      },
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 1,
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
