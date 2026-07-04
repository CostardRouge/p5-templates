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
    shadowsCount: 5,
    shadowIndexStep: 0.01,
    weightStart: 20,
    weightEnd: 20,
    opacityStart: 3,
    opacityEnd: 1,
    linesCount: 5,
    sizeRatio: 5
  },
  motion: {
    driftDivisor: 2.5,
    xSpeed: 1,
    ySpeed: 2,
    xDriftMult: 1.5,
    yDriftMult: 2,
    rotateAmp: 2,
    rotateSpeed: 1
  },
  colors: {
    opacityPulseSpeed: 5,
    opacityPulseMaxFactor: 10,
    opacityPulseFreq: 2,
    hueRedMix: 5,
    hueGreenMix: 2,
    hueBlueMix: 5,
    hueShadowGreenMult: 1,
    hueShadowBlueMult: 2
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
        min: 1,
        max: 600,
        step: 1
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
      linesCount: {
        label: "Lines count",
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
      xDriftMult: {
        label: "X drift mult",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      yDriftMult: {
        label: "Y drift mult",
        component: "slider",
        min: 0,
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
      hueRedMix: {
        label: "Hue red mix",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      hueGreenMix: {
        label: "Hue green mix",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      hueBlueMix: {
        label: "Hue blue mix",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      hueShadowGreenMult: {
        label: "Hue shadow green mult",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      hueShadowBlueMult: {
        label: "Hue shadow blue mult",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
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
