import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 5,
    yCount: 1,
    sizeDivisor: 3.5,
    axis: "vertical" as "vertical" | "horizontal"
  },
  spiral: {
    lerpSteps: 190,
    waveMultMin: 3,
    waveMultMax: 8,
    waveAmpDivisor: 8,
    angleScale: 5,
    circleSize: 100,
    drawDouble: false
  },
  motion: {
    timeSpeed: 1,
    indexScale: 10,
    cadenceMin: -4,
    cadenceMax: 4
  },
  colors: {
    cadenceContribution: 1
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
      waveMultMin: {
        label: "Wave mult min",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      waveMultMax: {
        label: "Wave mult max",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      waveAmpDivisor: {
        label: "Wave amp divisor",
        component: "slider",
        min: 1,
        max: 20,
        step: 0.1
      },
      angleScale: {
        label: "Angle scale",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      },
      circleSize: {
        label: "Circle size",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      },
      drawDouble: {
        label: "Draw mirrored",
        component: "checkbox"
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
        max: 10,
        step: 0.01
      },
      indexScale: {
        label: "Index scale",
        component: "slider",
        min: 1,
        max: 30,
        step: 0.1
      },
      cadenceMin: {
        label: "Cadence min",
        component: "slider",
        min: -20,
        max: 0,
        step: 0.1
      },
      cadenceMax: {
        label: "Cadence max",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      cadenceContribution: {
        label: "Cadence contribution",
        component: "slider",
        min: 0,
        max: 5,
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
