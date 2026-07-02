import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 2,
    sizeDivisor: 3.5,
    axis: "vertical" as
      | "vertical"
      | "horizontal"
      | "horizontal-narrow"
      | "horizontal-third"
      | "vertical-third"
  },
  spiral: {
    lerpSteps: 200,
    weightMin: 75,
    weightMax: 250,
    opacityMin: 1,
    opacityMax: 6,
    waveAmpRange: 1.5
  },
  motion: {
    timeSpeed: 1,
    lerpStepsCycle: [
      5,
      10,
      20,
      40,
      80,
      100,
      150,
      150,
      150
    ]
  },
  colors: {
    hueSpeed: 1
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
            label: "Horizontal narrow",
            value: "horizontal-narrow"
          },
          {
            label: "Horizontal third",
            value: "horizontal-third"
          },
          {
            label: "Vertical third",
            value: "vertical-third"
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
      weightMin: {
        label: "Stroke weight min",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      },
      weightMax: {
        label: "Stroke weight max",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
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
      waveAmpRange: {
        label: "Wave amp range",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.05
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
