import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
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
    shadowsCountMin: 1,
    shadowsCountMax: 2,
    shadowsCountSpeedA: 3,
    shadowsCountSpeedB: 0.333,
    shadowIndexStep: 0.01,
    sizeStart: 50,
    sizeEnd: 15,
    opacityStart: 3,
    opacityEnd: 1,
    linesCount: 7,
    sizeRatio: 6
  },
  motion: {
    driftDivisor: 3,
    xDriftMult: 5,
    yDriftMult: 10,
    eccentricAmp: 5,
    rotateSpinSpeed: 20
  },
  colors: {
    opacityPulseSpeed: 5,
    opacityPulseMaxFactor: 5,
    opacityPulseFreq: 5,
    hueShadowMixA: 2,
    hueShadowMixB: 2,
    hueShadowMixC: 1
  },
  grid: {
    enabled: true,
    xCount: 5,
    yCount: 7,
    driftSpeed: 100,
    opacityMax: 100,
    strokeWeight: 2,
    color: [
      128,
      128,
      255
    ] as number[]
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
      shadowsCountSpeedA: {
        label: "Shadows count speed A",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      shadowsCountSpeedB: {
        label: "Shadows count speed B",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
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
      xDriftMult: {
        label: "X drift mult",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      yDriftMult: {
        label: "Y drift mult",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      eccentricAmp: {
        label: "Eccentric amplitude",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      rotateSpinSpeed: {
        label: "Rotate spin speed",
        component: "slider",
        min: 0,
        max: 100,
        step: 0.5
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
  grid: {
    component: "nested-object",
    label: "Background grid",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox"
      },
      xCount: {
        label: "X count",
        component: "slider",
        min: 1,
        max: 30,
        step: 1
      },
      yCount: {
        label: "Y count",
        component: "slider",
        min: 1,
        max: 30,
        step: 1
      },
      driftSpeed: {
        label: "Drift speed",
        component: "slider",
        min: 0,
        max: 500,
        step: 1
      },
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0.5,
        max: 10,
        step: 0.5
      },
      color: {
        component: "color",
        label: "Grid color"
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
