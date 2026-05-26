import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 5,
    sizeDivisor: 5.5,
    axis: "horizontal" as "vertical" | "horizontal"
  },
  spiral: {
    lerpSteps: 200,
    waveAmplitudeDivisor: 1,
    circleSize: 80
  },
  motion: {
    timeSpeed: 3,
    angleLimitSpeed: 1,
    alternateDirection: true
  },
  colors: {
    hueSpeed: -2
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
      waveAmplitudeDivisor: {
        label: "Wave amplitude divisor",
        component: "slider",
        min: 0.2,
        max: 20,
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
      timeSpeed: {
        label: "Time speed",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      angleLimitSpeed: {
        label: "Angle limit speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      alternateDirection: {
        label: "Alternate row direction",
        component: "checkbox"
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
