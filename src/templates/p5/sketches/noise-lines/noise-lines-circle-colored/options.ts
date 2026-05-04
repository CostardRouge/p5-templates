import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";

import {
  createFixedOrVariableOption, createVariableOption
} from "@/utils/sketchOptionUtils";

export const formValues = {
  shape: {
    linesCount: 65,
    strokeWeight: 25,
    incrementStep: 0.05
  },
  roughness: {
    mode: "fixed",
    value: 1.5
  },
  magnitude: {
    mode: "variable",
    count: 1,
    speedMultiplier: 1,
    progressionMultiplier: 1,
    start: 125,
    end: 225,
    easingFn: "easeInOutExpo"
  },
  baseRadius: {
    mode: "variable",
    count: 1,
    speedMultiplier: 1,
    progressionMultiplier: 1,
    start: 190.5,
    end: 200,
    easingFn: "easeInOutExpo"
  },
  radiusOffsetMultiplier: {
    mode: "variable",
    count: 1,
    speedMultiplier: 1,
    progressionMultiplier: 1,
    start: 4,
    end: 5.70,
    easingFn: "easeInOutSine"
  },
  noisePhaseMultiplier: {
    mode: "variable",
    count: 1,
    speedMultiplier: 3,
    progressionMultiplier: 1,
    start: 0.02,
    end: 0.03,
    easingFn: "easeInOutBack"
  },
  colors: {
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
    0,
    0,
    0
  ],
  title: titleDefaultValues
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 100,
        step: 0.1
      },
      linesCount: {
        label: "Lines count",
        component: "slider",
        min: 1,
        max: 1000,
        step: 1
      },
      incrementStep: {
        label: "Increment step",
        component: "slider",
        min: 0.01,
        max: 3.14,
        step: 0.01
      }
    }
  },
  roughness: createFixedOrVariableOption(
    "roughness",
    {
      min: 0,
      max: 10,
      step: 0.1
    }
  ),
  magnitude: createFixedOrVariableOption(
    "magnitude",
    {
      min: 0,
      max: 500,
      step: 0.1
    }
  ),
  baseRadius: createFixedOrVariableOption(
    "baseRadius",
    {
      min: 10,
      max: 500,
      step: 0.1
    }
  ),
  radiusOffsetMultiplier: createFixedOrVariableOption(
    "radiusOffsetMultiplier",
    {
      min: 0.1,
      max: 15,
      step: 0.1
    }
  ),
  noisePhaseMultiplier: createFixedOrVariableOption(
    "noisePhaseMultiplier",
    {
      min: 0.01,
      max: 1,
      step: 0.01
    }
  ),

  colors: {
    label: "Colors",
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

  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
