
import {
  createFixedOrVariableOption
} from "@/utils/sketchOptionUtils";

export const formValues = {
  shape: {
    stroke: [
      0
    ],
    strokeWeight: 3.9,
    linesCount: 200,
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
  backgroundColor: [
    246,
    235,
    225
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      stroke: {
        label: "Stroke",
        component: "color"
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 10,
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

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
