import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 5.2,
    axis: "vertical" as "vertical" | "horizontal" | "diagonal"
  },
  spiral: {
    lerpStepsMin: 373,
    lerpStepsMax: 684,
    weight: 75,
    opacityFactor: 1.7,
    waveAmpRange: 1.48
  },
  motion: {
    timeSpeed: 1,
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
    hueSpeed: 1
  },
  backgroundColor: [
    0,
    0,
    0
  ] as number[],
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
          },
          {
            label: "Diagonal",
            value: "diagonal"
          }
        ]
      }
    }
  },
  spiral: {
    component: "nested-object",
    label: "Spiral",
    fields: {
      lerpStepsMin: {
        label: "Lerp steps min",
        component: "slider",
        min: 5,
        max: 500,
        step: 1
      },
      lerpStepsMax: {
        label: "Lerp steps max",
        component: "slider",
        min: 5,
        max: 800,
        step: 1
      },
      weight: {
        label: "Stroke weight",
        component: "slider",
        min: 1,
        max: 350,
        step: 1
      },
      opacityFactor: {
        label: "Opacity factor",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      },
      waveAmpRange: {
        label: "Wave amplitude range",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      timeSpeed: {
        label: "Time speed",
        component: "slider",
        min: 0,
        max: 5,
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
        label: "Hue speed",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
