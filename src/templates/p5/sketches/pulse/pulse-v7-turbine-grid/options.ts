import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  layoutFormConfiguration
} from "../_form";

export const formValues = {
  layout: {
    xCount: 3,
    yCount: 4,
    sizeDivisor: 3
  },
  spiral: {
    shadowsCountMin: 1,
    shadowsCountMax: 5,
    shadowsCountSpeed: 3,
    shadowIndexStep: 0.1,
    sizeStart: 50,
    sizeEnd: 15,
    opacityStart: 3,
    opacityEnd: 1,
    linesCountMin: 1,
    linesCountMax: 7,
    sizeRatio: 1,
    strokeWeightFactor: 0.25
  },
  motion: {
    driftDivisor: 2,
    xWaveSpeed: 1,
    xWaveAmpSpeed: 2,
    ySpeed: 2,
    xDriftMult: 1.5,
    yDriftMult: 3,
    rotateAmp: 1,
    rotateSpeed: 1
  },
  colors: {
    opacityPulseSpeed: 5,
    opacityPulseMaxFactor: 5,
    opacityPulseFreq: 5,
    hueShadowMixA: 2,
    hueShadowMixB: 2,
    hueShadowMixC: 1
  },
  background: {
    color: [
      0,
      0,
      0,
      255
    ] as number[]
  },
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  layout: layoutFormConfiguration,
  spiral: {
    component: "nested-object",
    label: "Spiral",
    fields: {
      shadowsCountMin: {
        label: "Shadows count min",
        component: "slider",
        min: 1,
        max: 50,
        step: 1
      },
      shadowsCountMax: {
        label: "Shadows count max",
        component: "slider",
        min: 1,
        max: 50,
        step: 1
      },
      shadowsCountSpeed: {
        label: "Shadows count speed",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      shadowIndexStep: {
        label: "Shadow step",
        component: "slider",
        min: 0.001,
        max: 0.5,
        step: 0.001
      },
      sizeStart: {
        label: "Size start",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      },
      sizeEnd: {
        label: "Size end",
        component: "slider",
        min: 1,
        max: 300,
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
      linesCountMin: {
        label: "Lines count min",
        component: "slider",
        min: 1,
        max: 32,
        step: 1
      },
      linesCountMax: {
        label: "Lines count max",
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
      },
      strokeWeightFactor: {
        label: "Stroke weight factor",
        component: "slider",
        min: 0.05,
        max: 5,
        step: 0.01
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
      xWaveSpeed: {
        label: "X wave speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      xWaveAmpSpeed: {
        label: "X wave amp speed",
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
      hueShadowMixA: {
        label: "Hue shadow mix A",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      hueShadowMixB: {
        label: "Hue shadow mix B",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      hueShadowMixC: {
        label: "Hue shadow mix C",
        component: "slider",
        min: 0,
        max: 20,
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
  },
  title: titleFormConfiguration
};
