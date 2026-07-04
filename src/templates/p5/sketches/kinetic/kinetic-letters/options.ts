import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Shared interaction defaults, tuned for kinetic-letters: one orbiting virtual
// pointer drives the letters out of the box (matching the sketch's original
// behaviour), with a thin black crosshair through each pointer. Mouse and
// vision stay opt-in; the user can flip on any source from the form.
const interactionDefaults = {
  ...interactionFormValues,
  visualization: {
    ...interactionFormValues.visualization,
    showPointers: false,
    showLegend: false,
    linesStroke: [
      0
    ],
    linesStrokeWeight: 2
  }
};

export const formValues = {
  text: "abcdefghijklmnopqrstuvwxyz0123456789",
  font: "waverseVariable",
  fill: [
    0
  ],
  stroke: [
    246,
    235,
    225
  ],
  strokeWeight: 2,
  minLetterSize: 24,
  maxLetterSize: 512,
  letterPositionMargin: 100,
  // How each letter reacts to the nearest interaction pointer.
  response: {
    varySize: true,
    varyAngle: true,
    maxInfluenceDistance: 250,
    easing: "easeOutSine"
  },
  interaction: interactionDefaults,
  backgroundColor: [
    246,
    235,
    225
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  text: {
    component: "text",
    label: "Text content"
  },
  font: {
    component: "select",
    label: "Font name",
    options: fontNames.map( ( fontName ) => ( {
      value: fontName,
      label: fontName
    } ) )
  },
  fill: {
    component: "color",
    label: "Fill color"
  },
  stroke: {
    component: "color",
    label: "Stroke color"
  },
  strokeWeight: {
    component: "slider",
    label: "Stroke weight",
    min: 8,
    max: 200,
    step: 1
  },
  minLetterSize: {
    component: "slider",
    label: "Min letter size",
    min: 8,
    max: 200,
    step: 1
  },
  maxLetterSize: {
    component: "slider",
    label: "Max letter size",
    min: 50,
    max: 1000,
    step: 1
  },
  letterPositionMargin: {
    component: "slider",
    label: "Letter position margin",
    min: 0,
    max: 500,
    step: 1
  },
  response: {
    component: "nested-object",
    label: "Letter response",
    fields: {
      varySize: {
        component: "checkbox",
        label: "Vary size"
      },
      varyAngle: {
        component: "checkbox",
        label: "Vary angle"
      },
      maxInfluenceDistance: {
        component: "slider",
        label: "Max influence distance",
        min: 0,
        max: 500,
        step: 1
      },
      easing: {
        component: "easing",
        label: "Easing function"
      }
    }
  },
  interaction: interactionFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
