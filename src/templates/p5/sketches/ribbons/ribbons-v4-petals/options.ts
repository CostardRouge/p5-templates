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
    petalsCycle: [
      2,
      1,
      2
    ],
    stepCycle: [
      2,
      5,
      3,
      2,
      4,
      1
    ],
    breathSpeed: 1
  },
  lines: linesFormValues( {
    length: 100,
    weight: 80,
    maxCount: 2,
    regularLength: true
  } ),
  opacity: opacityFormValues( {
    speed: 3,
    groupCount: 6,
    startFactor: 3
  } ),
  rotation: rotationFormValues( {
    count: 1,
    speed: 1
  } ),
  colors: colorsFormValues( {
    palette: "rainbow"
  } ),
  background: {
    columns: 3,
    rows: 3,
    alpha: 5,
    weight: 3,
    tint: [
      255,
      255,
      255
    ] as number[],
    animationSpeed: 1
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  shape: shapeFormConfiguration( {
    breathSpeed: {
      component: "slider",
      label: "Breath speed",
      min: -5,
      max: 5,
      step: 0.01
    }
  } ),
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  rotation: rotationFormConfiguration(),
  colors: colorsFormConfiguration(),
  background: {
    component: "nested-object",
    label: "Background grid",
    fields: {
      columns: {
        component: "slider",
        label: "Columns",
        min: 1,
        max: 30,
        step: 1
      },
      rows: {
        component: "slider",
        label: "Rows",
        min: 1,
        max: 30,
        step: 1
      },
      alpha: {
        component: "slider",
        label: "Alpha",
        min: 0,
        max: 255,
        step: 1
      },
      weight: {
        component: "slider",
        label: "Weight",
        min: 1,
        max: 20,
        step: 1
      },
      tint: {
        component: "color",
        label: "Grid tint"
      },
      animationSpeed: {
        component: "slider",
        label: "Animation speed",
        min: -3,
        max: 3,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
