import easing from "@/p5/utils/easing";
import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

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
  interactive: {
    varySize: true,
    varyAngle: true,
    maxInfluenceDistance: 250,
    easing: "easeOutSine",
    useMouse: false,
    useHands: false,
    pointersCount: 1,
    pointersMargin: 150,
    pointersSinAngleMultiplier: 2,
    pointersCosAngleMultiplier: 1,
    pointersSinProgressionMultiplier: 1,
    pointersCosProgressionMultiplier: 4,
    pointersImageShow: true,
    pointersLinesShow: true,
    pointersLinesStroke: [
      0
    ],
    pointersLinesStrokeWeight: 2,
  },
  // title: titleDefaultValues,
  backgroundColor: [
    246,
    235,
    225
  ],
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  text: {
    component: "text",
    label: "Text content",
  },
  font: {
    component: "select",
    label: "Font name",
    options: fontNames.map( ( fontName ) => ( {
      value: fontName,
      label: fontName,
    } ) ),
  },
  fill: {
    component: "color",
    label: "Fill color",
  },
  stroke: {
    component: "color",
    label: "Stroke color",
  },
  strokeWeight: {
    component: "slider",
    label: "Stroke weight",
    min: 8,
    max: 200,
    step: 1,
  },
  minLetterSize: {
    component: "slider",
    label: "Min letter size",
    min: 8,
    max: 200,
    step: 1,
  },
  maxLetterSize: {
    component: "slider",
    label: "Max letter size",
    min: 50,
    max: 1000,
    step: 1,
  },
  letterPositionMargin: {
    component: "slider",
    label: "Letter position margin",
    min: 0,
    max: 500,
    step: 1,
  },
  interactive: {
    component: "nested-object",
    label: "Interactive",
    fields: {
      varySize: {
        component: "checkbox",
        label: "Vary size",
      },
      varyAngle: {
        component: "checkbox",
        label: "Vary angle",
      },
      maxInfluenceDistance: {
        component: "slider",
        label: "Max influence distance",
        min: 0,
        max: 500,
        step: 1,
      },
      easing: {
        component: "select",
        label: "Easing function",
        options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
          label: easingFunctionName,
          value: easingFunctionName,
        } ) ),
      },
      useMouse: {
        component: "checkbox",
        label: "Use mouse",
      },
      useHands: {
        component: "checkbox",
        label: "Use hands",
      },
      pointersCount: {
        component: "slider",
        label: "Pointers count",
        min: 0,
        max: 24,
        step: 1,
      },
      pointersMargin: {
        component: "slider",
        label: "Pointers margin",
        min: 0,
        max: 500,
        step: 1,
      },
      pointersSinAngleMultiplier: {
        component: "slider",
        label: "Sin angle multiplier",
        min: 0.1,
        max: 10,
        step: 0.1,
      },
      pointersCosAngleMultiplier: {
        component: "slider",
        label: "Cos angle multiplier",
        min: 0.1,
        max: 10,
        step: 0.1,
      },
      pointersSinProgressionMultiplier: {
        component: "slider",
        label: "Sin progression multiplier",
        min: 0.1,
        max: 10,
        step: 0.1,
      },
      pointersCosProgressionMultiplier: {
        component: "slider",
        label: "Cos progression multiplier",
        min: 0.1,
        max: 10,
        step: 0.1,
      },
      pointersImageShow: {
        component: "checkbox",
        label: "Show pointer images",
      },
      pointersLinesShow: {
        component: "checkbox",
        label: "Show pointer lines",
      },
      pointersLinesStroke: {
        component: "color",
        label: "Pointer lines stroke",
      },
      pointersLinesStrokeWeight: {
        component: "slider",
        label: "Pointer lines stroke weight",
        min: 0.5,
        max: 10,
        step: 0.5,
      },
    },
  },
  // title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
};
