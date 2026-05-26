import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 4,
    sizeDivisor: 5.5,
    axis: "horizontal-narrow" as
      | "vertical"
      | "horizontal"
      | "horizontal-narrow"
      | "horizontal-third"
      | "vertical-third"
  },
  spiral: {
    lerpSteps: 400,
    angleLimit: 6.28318,
    angleDivisor: 0.5,
    waveAmplitudeDivisor: 1,
    variantOverride: -1
  },
  motion: {
    timeSpeed: 3,
    alternate: true
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
      angleLimit: {
        label: "Angle limit",
        component: "slider",
        min: 0.1,
        max: 12.57,
        step: 0.01
      },
      angleDivisor: {
        label: "Angle range divisor",
        component: "slider",
        min: 0.05,
        max: 5,
        step: 0.01
      },
      waveAmplitudeDivisor: {
        label: "Wave amplitude divisor",
        component: "slider",
        min: 0.5,
        max: 10,
        step: 0.1
      },
      variantOverride: {
        label: "Variant override (-1 = per row)",
        component: "slider",
        min: -1,
        max: 3,
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
      alternate: {
        label: "Alternate direction",
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
