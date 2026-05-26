import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3.5,
    axis: "vertical-third" as
      | "vertical"
      | "horizontal"
      | "horizontal-narrow"
      | "horizontal-third"
      | "vertical-third"
  },
  spiral: {
    lerpSteps: 350,
    waveAmplitudeDivisor: 1.5,
    circleSize: 120
  },
  motion: {
    angleModSpeed: 1,
    waveTimeScale: 2,
    timeMin: -8,
    timeMax: 8
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
      waveAmplitudeDivisor: {
        label: "Wave amplitude divisor",
        component: "slider",
        min: 0.2,
        max: 10,
        step: 0.1
      },
      circleSize: {
        label: "Circle size",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      angleModSpeed: {
        label: "Angle modulation speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      waveTimeScale: {
        label: "Wave time scale",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      timeMin: {
        label: "Inner time min",
        component: "slider",
        min: -30,
        max: 0,
        step: 0.1
      },
      timeMax: {
        label: "Inner time max",
        component: "slider",
        min: 0,
        max: 30,
        step: 0.1
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
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
