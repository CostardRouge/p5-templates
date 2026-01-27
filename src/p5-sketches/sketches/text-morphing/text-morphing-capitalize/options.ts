import easing from "@/p5/utils/easing";
import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  text: {
    from: "a",
    to: "z",
    font: "loraItalic",
    size: 0.5,
    sampleFactor: 0.0625,
    simplifyThreshold: 0,
  },
  sliders: {
    enabled: true,
    margin: 0.1,
    stroke: [
      128,
      128,
      255
    ],
    cross: {
      enabled: true,
      strokeWeight: 5,
      size: 20,
    },
    line: {
      enabled: true,
      strokeWeight: 3.5,
    },
    circle: {
      enabled: true,
      radius: 50,
      fill: [
        0
      ],
      strokeWeight: 5,
    },
  },
  morphing: {
    easing: "easeInOutExpo",
    depthLayersCount: 50,
    depthLength: -0.2,
    point: {
      strokeWeightMax: 20,
      strokeWeightMin: 3,
      strokeWeightEasing: "easeOutExpo",
    },
  },
  backgroundColor: [
    0,
    0,
    0
  ],
  title: {
    ...titleDefaultValues,
  },
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  text: {
    component: "nested-object",
    label: "Text",
    fields: {
      from: {
        label: "From text",
        component: "text",
      },
      to: {
        label: "To text",
        component: "text",
      },
      font: {
        component: "select",
        label: "Font name",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName,
        } ) ),
      },
      size: {
        label: "Size",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1,
      },
      sampleFactor: {
        label: "Text sample factor",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01,
      },
      simplifyThreshold: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1,
      },
    },
  },
  morphing: {
    component: "nested-object",
    label: "Morphing",
    fields: {
      easing: {
        component: "select",
        label: "Morphing easing function",
        options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
          label: easingFunctionName,
          value: easingFunctionName,
        } ) ),
      },
      depthLayersCount: {
        label: "Depth layers count",
        component: "slider",
        min: 1,
        max: 1000,
        step: 1,
      },
      depthLength: {
        label: "Depth length",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01,
      },
      point: {
        component: "nested-object",
        label: "Point settings",
        fields: {
          strokeWeightMax: {
            label: "Max stroke weight",
            component: "slider",
            min: 1,
            max: 150,
            step: 1,
          },
          strokeWeightMin: {
            label: "Min stroke weight",
            component: "slider",
            min: 1,
            max: 150,
            step: 1,
          },
          strokeWeightEasing: {
            component: "select",
            label: "Stroke weight easing function",
            options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
              label: easingFunctionName,
              value: easingFunctionName,
            } ) ),
          },
        },
      },
    },
  },
  sliders: {
    component: "nested-object",
    label: "Sliders",
    fields: {
      enabled: {
        label: "Display sliders?",
        component: "checkbox",
      },
      margin: {
        label: "Margin",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      stroke: {
        label: "Stroke",
        component: "color",
      },
      cross: {
        component: "nested-object",
        label: "Cross",
        fields: {
          enabled: {
            label: "Display crosses?",
            component: "checkbox",
          },
          strokeWeight: {
            label: "Cross stroke weight",
            component: "slider",
            min: 1,
            max: 20,
            step: 0.1,
          },
          size: {
            label: "Cross size",
            component: "slider",
            min: 1,
            max: 100,
            step: 0.1,
          },
        },
      },
      line: {
        component: "nested-object",
        label: "Line",
        fields: {
          enabled: {
            label: "Display lines?",
            component: "checkbox",
          },
          strokeWeight: {
            label: "Line stroke weight",
            component: "slider",
            min: 1,
            max: 20,
            step: 0.1,
          },
        },
      },
      circle: {
        component: "nested-object",
        label: "Circle",
        fields: {
          enabled: {
            label: "Display circles?",
            component: "checkbox",
          },
          radius: {
            label: "Circle radius",
            component: "slider",
            min: 1,
            max: 100,
            step: 0.1,
          },
          strokeWeight: {
            label: "Circle stroke weight",
            component: "slider",
            min: 1,
            max: 20,
            step: 0.1,
          },
          fill: {
            label: "Circle fill",
            component: "color",
          },
        },
      },
    },
  },
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
  title: {
    ...titleFormConfiguration,
  },
};
