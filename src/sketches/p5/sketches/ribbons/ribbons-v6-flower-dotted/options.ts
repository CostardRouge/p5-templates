import {
  linesFormValues,
  linesFormConfiguration,
  opacityFormValues,
  opacityFormConfiguration,
  rotationFormValues,
  rotationFormConfiguration,
  colorsFormValues,
  colorsFormConfiguration,
  shapeFormValues,
  shapeFormConfiguration
} from "../_options";

export const formValues = {
  shape: {
    ...shapeFormValues( 400 ),
    foldCycle: [
      2,
      1,
      1,
      1,
      2
    ],
    dotMultX: 1,
    dotMultY: 1,
    foldSpeed: 0.5
  },
  lines: linesFormValues( {
    length: 150,
    weight: 80,
    maxCount: 2.5
  } ),
  opacity: opacityFormValues( {
    speed: 3,
    groupCount: 6,
    startFactor: 3
  } ),
  rotation: rotationFormValues( {
    count: 1,
    speed: 1,
    indexMultiplier: 2,
    timeMultiplier: 2
  } ),
  colors: colorsFormValues( {
    palette: "rainbow"
  } ),
  backgroundColor: [
    0,
    0,
    0,
    255
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  shape: shapeFormConfiguration( {
    dotMultX: {
      component: "slider",
      label: "Dot X multiplier",
      min: 0,
      max: 3,
      step: 0.01
    },
    dotMultY: {
      component: "slider",
      label: "Dot Y multiplier",
      min: 0,
      max: 3,
      step: 0.01
    },
    foldSpeed: {
      component: "slider",
      label: "Fold speed",
      min: -3,
      max: 3,
      step: 0.01
    }
  } ),
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  rotation: rotationFormConfiguration( {
    timeMultiplier: {
      component: "slider",
      label: "Time multiplier",
      min: -5,
      max: 5,
      step: 0.01
    }
  } ),
  colors: colorsFormConfiguration(),
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
