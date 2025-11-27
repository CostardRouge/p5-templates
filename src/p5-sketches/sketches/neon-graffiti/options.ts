export const formValues = {
  amplitude: 200,
  shadowsCount: 3,
  stepsCount: 500,
  innerCircleSize: 40,
  stepAngleAmplitude: 1,
  sinAmplitudeMultiplier: 2,
  cosAmplitudeMultiplier: 1,
  sinAngleMultiplier: 2,
  cosAngleMultiplier: 2,
  hueIndexMultiplier: 1.5,
  hueAmplitude: Math.PI,
  circleSizeEasing: "easeOutSine",
  positionSinEasing: "easeInOutQuad",
  positionCosEasing: "easeInOutSine",
  positionCosMultiplier: 8,
  hueEasing: "easeInOutSine",
  hueStepDivider: 10,
  opacityStart: 1,
  opacityEnd: 2.25,
  start: {
    x: 0,
    y: 0.5
  },
  end: {
    x: 1,
    y: 0.5
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ]
};

import easing from "@/p5-sketches/utils/easing";

export const formConfiguration: Record<string, any> = {
  amplitude: {
    label: "Amplitude",
    component: "slider",
    min: 10,
    max: 1000,
    step: 1
  },
  shadowsCount: {
    label: "Shadows count",
    component: "slider",
    min: 1,
    max: 30,
    step: 1
  },
  stepsCount: {
    label: "Steps count",
    component: "slider",
    min: 50,
    max: 1000,
    step: 10
  },
  innerCircleSize: {
    label: "Inner circle size",
    component: "slider",
    min: 1,
    max: 100,
    step: 1
  },
  stepAngleAmplitude: {
    label: "Step angle amplitude",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.1
  },
  sinAmplitudeMultiplier: {
    label: "Sin amplitude multiplier",
    component: "slider",
    min: 0,
    max: 10,
    step: 0.1
  },
  cosAmplitudeMultiplier: {
    label: "Cos amplitude multiplier",
    component: "slider",
    min: 0,
    max: 10,
    step: 0.1
  },
  sinAngleMultiplier: {
    label: "Sin angle multiplier",
    component: "slider",
    min: 0,
    max: 10,
    step: 0.1
  },
  cosAngleMultiplier: {
    label: "Cos angle multiplier",
    component: "slider",
    min: 0,
    max: 10,
    step: 0.1
  },
  hueIndexMultiplier: {
    label: "Hue index multiplier",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.1
  },
  hueAmplitude: {
    label: "Hue amplitude",
    component: "slider",
    min: 0,
    max: Math.PI * 2,
    step: 0.1
  },
  circleSizeEasing: {
    component: "select",
    label: "Circle size easing",
    options: Object.keys(easing).map(easingFunctionName => ({
      label: easingFunctionName,
      value: easingFunctionName,
    }))
  },
  positionSinEasing: {
    component: "select",
    label: "Position sin easing",
    options: Object.keys(easing).map(easingFunctionName => ({
      label: easingFunctionName,
      value: easingFunctionName,
    }))
  },
  positionCosEasing: {
    component: "select",
    label: "Position cos easing",
    options: Object.keys(easing).map(easingFunctionName => ({
      label: easingFunctionName,
      value: easingFunctionName,
    }))
  },
  positionCosMultiplier: {
    label: "Position cos multiplier",
    component: "slider",
    min: 1,
    max: 20,
    step: 1
  },
  hueEasing: {
    component: "select",
    label: "Hue easing",
    options: Object.keys(easing).map(easingFunctionName => ({
      label: easingFunctionName,
      value: easingFunctionName,
    }))
  },
  hueStepDivider: {
    label: "Hue step divider",
    component: "slider",
    min: 1,
    max: 50,
    step: 1
  },
  opacityStart: {
    label: "Opacity start",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.05
  },
  opacityEnd: {
    label: "Opacity end",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.05
  },
  start: {
    label: "Start position",
    component: "nested-object",
    fields: {
      x: {
        label: "X (0-1)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      y: {
        label: "Y (0-1)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  end: {
    label: "End position",
    component: "nested-object",
    fields: {
      x: {
        label: "X (0-1)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      y: {
        label: "Y (0-1)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
};
