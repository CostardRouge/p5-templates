import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 4,
    yCount: 1,
    sizeDivisor: 3.2,
    axis: "vertical" as "vertical" | "horizontal"
  },
  spiral: {
    lerpSteps: 395,
    strokeWeightMin: 82,
    strokeWeightMax: 82,
    weightSpeed: 5,
    weightWaveScale: 11.3
  },
  motion: {
    timeScale: 1,
    xWaveSpeed: 2,
    yWaveSpeed: 1,
    polarSeqLerp: 0.009,
    xPolarValues: [
      1,
      2,
      4,
      2,
      3,
      1
    ],
    yPolarValues: [
      1,
      3,
      3,
      4,
      3,
      1
    ]
  },
  colors: {
    hueSpeed: 3,
    opacityCurveSpeed: 50,
    opacityMin: 1,
    opacityMax: 7,
    alphaScale: 15
  },
  background: {
    color: [
      0,
      0,
      0,
      8
    ] as number[]
  },
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
        max: 20,
        step: 1
      },
      yCount: {
        label: "Y count",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      sizeDivisor: {
        label: "Size divisor",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      },
      axis: {
        label: "Axis",
        component: "select",
        options: [
          {
            label: "Vertical",
            value: "vertical"
          },
          {
            label: "Horizontal",
            value: "horizontal"
          }
        ]
      }
    }
  },
  spiral: {
    component: "nested-object",
    label: "Spiral",
    fields: {
      lerpSteps: {
        label: "Lerp steps",
        component: "slider",
        min: 20,
        max: 2000,
        step: 1
      },
      strokeWeightMin: {
        label: "Stroke weight min",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      strokeWeightMax: {
        label: "Stroke weight max",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      weightSpeed: {
        label: "Weight speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      weightWaveScale: {
        label: "Weight wave scale",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      timeScale: {
        label: "Time scale",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      xWaveSpeed: {
        label: "X wave speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      },
      yWaveSpeed: {
        label: "Y wave speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      },
      polarSeqLerp: {
        label: "Polar sequence lerp",
        component: "slider",
        min: 0.001,
        max: 0.5,
        step: 0.001
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
        step: 0.01
      },
      opacityCurveSpeed: {
        label: "Opacity curve speed",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.5
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
        max: 20,
        step: 0.1
      },
      alphaScale: {
        label: "Alpha scale",
        component: "slider",
        min: 1,
        max: 30,
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
