import easing from "@/p5/utils/easing";
import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import camelCaseToSpace from "@/utils/camelCaseToSpace";
import capitalize from "@/utils/capitalize";

function createSingleOrMultipleTextOption( optionName: string ) {
  const spacedOptionName = camelCaseToSpace( optionName );
  const capitalizedOptionName = capitalize( spacedOptionName );

  return ( {
    label: capitalizedOptionName,
    component: "conditional-group",
    conditionalOn: "mode",
    typeSelector: {
      options: [
        {
          label: "Single (letter by letter)",
          value: "single",
        },
        {
          label: "Multiple (word by word)",
          value: "multiple",
        },
      ],
    },
    configs: {
      single: {
        value: {
          label: "single",
          component: "text",
        },
      },
      multiple: {
        value: {
          label: "multiple",
          component: "item-list",
          itemConfig: {
            label: "Multiple",
            defaultItems: [
              "one",
              "two",
              "three"
            ]
          }
        },
      }
    }
  } );
}

export const formValues = {
  text: {
    mode: "single",
    value: "abc.xyz"
  },
  textStyle: {
    font: "waverseVariable",
    size: 0.5,
    sampleFactor: 0.0625,
    simplifyThreshold: 0,
  },
  rotation: {
    enabled: true,
    rotationAngles: [
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: Math.PI / 5,
        y: 0,
        z: 0
      },
      {
        x: -Math.PI / 5,
        y: Math.PI / 5,
        z: 0
      },
      {
        x: Math.PI / 4,
        y: Math.PI / 5
      },
      {
        x: -Math.PI / 5,
        y: -Math.PI / 5,
        z: 0
      },
    ],
    easing: "easeInOutExpo",
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
    0,
    0,
    0
  ],
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
      rotationAngles: {
        label: "Rotation angles",
        component: "item-list",
        itemConfig: {
          label: "3D vector",
          component: "nested-object",
          fields: {
            x: {
              label: "X rotation angle",
              component: "slider",
              min: 0,
              max: Math.PI * 2,
              step: 0.1,
            },
            y: {
              label: "Y rotation angle",
              component: "slider",
              min: 0,
              max: Math.PI * 2,
              step: 0.1,
            },
            z: {
              label: "Z rotation angle",
              component: "slider",
              min: 0,
              max: Math.PI * 2,
              step: 0.1,
            }
          }
        }
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
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
};
