import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 10,
    sizeDivisor: 3.5,
    axis: "horizontal-third" as
      | "vertical"
      | "horizontal"
      | "horizontal-narrow"
      | "horizontal-third"
      | "vertical-third"
  },
  spiral: {
    lerpSteps: 500,
    waveMultMin: 8,
    waveMultMax: 4,
    waveAmpMin: 0.5,
    waveAmpMax: 1,
    diameterMin: 30,
    diameterMax: 100
  },
  motion: {
    timeSpeed: 1,
    indexScale: 5
  },
  colors: {
    hueSpeed: 1,
    opacityFalloffMax: 200,
    opacityFalloffScale: 10,
    opacityCurveTimeScale: 3
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
        max: 30,
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
      waveAmpMin: {
        label: "Wave amp min",
        component: "slider",
        min: 0.05,
        max: 5,
        step: 0.01
      },
      waveAmpMax: {
        label: "Wave amp max",
        component: "slider",
        min: 0.05,
        max: 5,
        step: 0.01
      },
      diameterMin: {
        label: "Diameter min",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      },
      diameterMax: {
        label: "Diameter max",
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
        label: "Time speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      indexScale: {
        label: "Index scale",
        component: "slider",
        min: 0.1,
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
      },
      opacityFalloffMax: {
        label: "Opacity falloff max",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      },
      opacityFalloffScale: {
        label: "Opacity falloff scale",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.1
      },
      opacityCurveTimeScale: {
        label: "Opacity curve time scale",
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
