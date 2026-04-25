import easing from "@/p5/utils/easing";
import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

import {
  createSingleOrMultipleTextOption
} from "@/utils/sketchOptionUtils";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  text: {
    mode: "single",
    value: "abcdefghijklmnopqrstuvwxyz"
  },
  textStyle: {
    font: "waverseVariable",
    size: 0.5,
    sampleFactor: 0.0625,
    simplifyThreshold: 0,
  },
  rotation: {
    enabled: true,
    xMultiplier: 1,
    yMultiplier: 1,
    easing: "easeInOutElastic",
  },
  morphing: {
    easing: "easeInOutExpo",
    depthEasing: "easeOutExpo",
    depthLayersCount: 50,
    depthLength: -0.2
  },
  point: {
    varyStrokeWithDepthProgression: true,
    strokeWeightMax: 10,
    strokeWeightMin: 5,
    strokeWeightEasing: "easeInOutExpo",
  },
  backgroundColor: [
    0
  ],
  title: titleDefaultValues,
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
    label: "Morphing animation",
    fields: {
      depthLayersCount: {
        label: "Depth layers count",
        component: "slider",
        min: 1,
        max: 1000,
        step: 1,
      },
      depthLength: {
        label: "Depth length multiplier",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01,
      },
      depthEasing: {
        component: "select",
        label: "Depth easing function",
        options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
          label: easingFunctionName,
          value: easingFunctionName,
        } ) ),
      },
      easing: {
        component: "select",
        label: "Morphing easing function",
        options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
          label: easingFunctionName,
          value: easingFunctionName,
        } ) ),
      }
    },
  },
  rotation: {
    component: "nested-object",
    label: "Rotation animation",
    fields: {
      enabled: {
        label: "Enable rotation?",
        component: "checkbox"
      },
      xMultiplier: {
        label: "X multiplier",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1,
      },
      yMultiplier: {
        label: "Y multiplier",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1,
      },
      easing: {
        component: "select",
        label: "Rotation easing function",
        options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
          label: easingFunctionName,
          value: easingFunctionName,
        } ) ),
      }
    },
  },
  point: {
    component: "nested-object",
    label: "Point settings",
    fields: {
      varyStrokeWithDepthProgression: {
        label: "Vary stroke weight with depth progression?",
        component: "checkbox",
      },
      strokeWeightMax: {
        label: "Max stroke weight",
        component: "slider",
        min: 1,
        max: 500,
        step: 1,
      },
      strokeWeightMin: {
        label: "Min stroke weight",
        component: "slider",
        min: 1,
        max: 500,
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
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
  title: titleFormConfiguration,
};
