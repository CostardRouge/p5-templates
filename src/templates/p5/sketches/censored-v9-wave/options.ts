import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  pixelDensity: 0.06,
  backgroundColor: [
    0,
    0,
    0
  ],
  shape: {
    text: "sinewave",
    colorScheme: "rainbow",
    font: "sans",
    sizeRatio: 0.5,
    sampleFactor: 0.1,
    simplifyThreshold: 0,
    pointsStrokeWeight: 15,

    morphingSpeed: 1,
    morphingEasing: "easeInOutExpo",

    depthCount: 60,
    depthStart: 0,
    depthEnd: -1.35,

    backgroundColor: [
      0,
      0,
      0
    ]
  },
  wave: {
    step: 0.01,
    count: 1,
    speed: 6,
    heightStart: 0.1666666667,
    heightEnd: 0.8333333333,
    easing: "easeInOutSine",
    stroke: [
      128,
      128,
      255
    ],
    strokeWeight: 2,
    close: false
  }
};

export const formConfiguration: Record<string, any> = {
  pixelDensity: {
    label: "Pixel density",
    component: "slider",
    min: 0.01,
    max: 1,
    step: 0.01
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  shape: {
    label: "Text points",
    component: "nested-object",
    fields: {
      text: {
        label: "Text",
        component: "text"
      },
      colorScheme: {
        component: "select",
        label: "Color scheme",
        options: [
          {
            value: "rainbow",
            label: "Rainbow"
          },
          {
            value: "purple",
            label: "Purple"
          }
        ]
      },
      font: {
        component: "select",
        label: "Font name",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      sizeRatio: {
        label: "Letter size",
        component: "slider",
        min: 0.1,
        max: 1,
        step: 0.1
      },
      sampleFactor: {
        label: "Text sample factor",
        component: "slider",
        min: 0.1,
        max: 1,
        step: 0.1
      },
      simplifyThreshold: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      morphingSpeed: {
        label: "Speed",
        component: "slider",
        min: 0.25,
        max: 20,
        step: 0.25
      },
      pointsStrokeWeight: {
        label: "Text points stroke weight",
        component: "slider",
        min: 1,
        max: 50,
        step: 1
      },

      depthCount: {
        label: "Depth count",
        component: "slider",
        min: 1,
        max: 100
      },
      depthStart: {
        label: "Depth start",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.1
      },
      depthEnd: {
        label: "Depth end",
        component: "slider",
        min: -2,
        max: 0,
        step: 0.1
      },

      easing: {
        component: "easing",
        label: "Wave easing"
      },
      backgroundColor: {
        component: "color",
        label: "Background color"
      }
    }
  },
  wave: {
    label: "Wave",
    component: "nested-object",
    fields: {
      step: {
        label: "Step",
        component: "slider",
        min: 0.01,
        max: 0.95,
        step: 0.001
      },
      count: {
        label: "Count",
        component: "slider",
        min: 0.25,
        max: 10,
        step: 0.25
      },
      speed: {
        label: "Speed",
        component: "slider",
        min: 0.25,
        max: 20,
        step: 0.25
      },
      heightStart: {
        label: "Height start",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.1
      },
      heightEnd: {
        label: "Height end",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.1
      },
      stroke: {
        label: "Stroke",
        component: "color"
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.1
      },
      easing: {
        component: "easing",
        label: "Wave easing"
      },
      close: {
        label: "Close shape",
        component: "checkbox"
      }
    }
  }
};
