import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 5,
    sizeDivisor: 3.5,
    axis: "horizontal" as "vertical" | "horizontal"
  },
  spiral: {
    lerpSteps: 500,
    angleAmpScale: 1,
    circleSizeMin: 10,
    circleSizeMax: 100
  },
  motion: {
    timeSpeed: 1,
    indexScale: 2,
    angleScale: 1
  },
  colors: {
    hueSpeed: -1,
    rMin: 64,
    rMax: 360,
    bMin: 64,
    bMax: 255
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
      angleAmpScale: {
        label: "Angle amplitude scale",
        component: "slider",
        min: 0.1,
        max: 5,
        step: 0.01
      },
      circleSizeMin: {
        label: "Circle size min",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      circleSizeMax: {
        label: "Circle size max",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      timeSpeed: {
        label: "Time speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      indexScale: {
        label: "Index scale",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.01
      },
      angleScale: {
        label: "Angle scale",
        component: "slider",
        min: 0.1,
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
        label: "Hue speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -10,
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
