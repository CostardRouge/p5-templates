import {
  layoutFormConfiguration
} from "../_form";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3
  },
  spiral: {
    shadowsCount: 7,
    shadowIndexStep: 0.01,
    weightStart: 200,
    weightEnd: 1,
    opacityStart: 5,
    opacityEnd: 1,
    angleSubdivisions: 1,
    sizeRatio: 5
  },
  motion: {
    driftDivisor: 3,
    xSpeed: 1,
    ySpeed: -2,
    rotateAmp: 1,
    rotateSpeed: 1
  },
  colors: {
    hueSpeed: 1,
    opacityPulseSpeed: 5,
    opacityPulseMaxFactor: 25,
    opacityPulseFreq: 4,
    strokeAlpha: 10
  },
  background: {
    color: [
      0,
      0,
      0,
      255
    ] as number[]
  }
};

export const formConfiguration: Record<string, any> = {
  layout: layoutFormConfiguration,
  spiral: {
    component: "nested-object",
    label: "Spiral",
    fields: {
      shadowsCount: {
        label: "Shadows count",
        component: "slider",
        min: 1,
        max: 50,
        step: 1
      },
      shadowIndexStep: {
        label: "Shadow step",
        component: "slider",
        min: 0.001,
        max: 0.5,
        step: 0.001
      },
      weightStart: {
        label: "Weight start",
        component: "slider",
        min: 1,
        max: 600,
        step: 1
      },
      weightEnd: {
        label: "Weight end",
        component: "slider",
        min: 0.1,
        max: 600,
        step: 0.5
      },
      opacityStart: {
        label: "Opacity start",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.1
      },
      opacityEnd: {
        label: "Opacity end",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.1
      },
      angleSubdivisions: {
        label: "Angle subdivisions",
        component: "slider",
        min: 1,
        max: 32,
        step: 1
      },
      sizeRatio: {
        label: "Size ratio",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      driftDivisor: {
        label: "Drift divisor",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      },
      xSpeed: {
        label: "X speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      ySpeed: {
        label: "Y speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      rotateAmp: {
        label: "Rotate amplitude",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      rotateSpeed: {
        label: "Rotate speed",
        component: "slider",
        min: 0,
        max: 10,
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
        min: 0,
        max: 10,
        step: 0.01
      },
      opacityPulseSpeed: {
        label: "Opacity pulse speed",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      opacityPulseMaxFactor: {
        label: "Opacity pulse max factor",
        component: "slider",
        min: 1,
        max: 100,
        step: 0.5
      },
      opacityPulseFreq: {
        label: "Opacity pulse freq",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      strokeAlpha: {
        label: "Stroke alpha",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      }
    }
  },
  background: {
    component: "nested-object",
    label: "Background",
    fields: {
      color: {
        component: "color",
        label: "Background color"
      }
    }
  }
};
