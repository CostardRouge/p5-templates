import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

import {
  createSingleOrMultipleTextOption, createVariableOption
} from "@/utils/sketchOptionUtils";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";

export const formValues = {
  text: {
    mode: "single",
    value: "perth"
  },
  textStyle: {
    font: "spaceMonoRegular",
    size: 0.75,
    sampleFactor: 0.0625,
    simplifyThreshold: 0
  },
  morphing: {
    easing: "easeInOutExpo",
    depthLayersCount: 150
  },
  point: {
    strokeWeightMin: 250,
    strokeWeightMax: 10,
    strokeWeightEasing: "easeOutQuad"
  },
  strokeColor: {
    colorFunction: "rainbow",
    hueIndex: {
      easing: "easeInOutSine",
      start: 3,
      end: 1,
      generalMultiplier: 6,
      xMultiplier: 1,
      yMultiplier: 2,
      zMultiplier: 2
    },
    opacityFactor: {
      easing: "easeInOutSine",
      start: 9,
      end: 1,
      generalMultiplier: 1,
      xMultiplier: 6,
      yMultiplier: 9,
      zMultiplier: 9
    }
  },
  backgroundColor: [
    0
  ],

  title: titleDefaultValues
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  text: createSingleOrMultipleTextOption( "text" ),
  textStyle: {
    component: "nested-object",
    label: "Text style",
    fields: {
      font: {
        component: "select",
        label: "Font name",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      size: {
        label: "Size",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      sampleFactor: {
        label: "Text sample factor",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01
      },
      simplifyThreshold: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      }
    }
  },
  morphing: {
    component: "nested-object",
    label: "Morphing animation",
    fields: {
      depthLayersCount: {
        label: "Depth layers count",
        component: "slider",
        min: 1,
        max: 1000,
        step: 1
      },
      easing: {
        component: "easing",
        label: "Morphing easing function"
      }
    }
  },
  point: {
    component: "nested-object",
    label: "Point settings",
    fields: {
      strokeWeightMin: {
        label: "Min stroke weight",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      },
      strokeWeightMax: {
        label: "Max stroke weight",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      },
      strokeWeightEasing: {
        component: "easing",
        label: "Stroke weight easing function"
      }
    }
  },
  strokeColor: {
    label: "Stroke color",
    component: "nested-object",
    fields: {
      colorFunction: {
        component: "select",
        label: "Palette",
        options: [
          {
            label: "Rainbow",
            value: "rainbow"
          },
          {
            label: "Purple",
            value: "purple"
          }
        ]
      },
      opacityFactor: createVariableOption(
        "opacityFactor",
        {
          min: 9,
          max: 1,
          step: 0.01
        }
      ),
      hueIndex: createVariableOption(
        "hueIndex",
        {
          min: 3,
          max: 1,
          step: 0.01
        }
      )
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  title: titleFormConfiguration
};
