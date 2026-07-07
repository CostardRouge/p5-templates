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
  shape: shapeFormValues( 400 ),
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
    speed: 1
  } ),
  colors: colorsFormValues( {
    palette: "rainbow"
  } ),
  background: {
    polygonCount: 10,
    weight: 4,
    alpha: 128,
    tint: [
      128,
      128,
      255
    ] as number[],
    innerRadius: 275,
    outerRadiusFactor: 1.2,
    vertexResolution: 64,
    animationSpeed: 0.25
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  shape: shapeFormConfiguration(),
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  rotation: rotationFormConfiguration(),
  colors: colorsFormConfiguration(),
  background: {
    component: "nested-object",
    label: "Background polygons",
    fields: {
      polygonCount: {
        component: "slider",
        label: "Polygon count",
        min: 1,
        max: 40,
        step: 1
      },
      weight: {
        component: "slider",
        label: "Weight",
        min: 1,
        max: 20,
        step: 1
      },
      alpha: {
        component: "slider",
        label: "Alpha",
        min: 0,
        max: 255,
        step: 1
      },
      tint: {
        component: "color",
        label: "Tint"
      },
      innerRadius: {
        component: "slider",
        label: "Inner radius",
        min: 0,
        max: 1500,
        step: 1
      },
      outerRadiusFactor: {
        component: "slider",
        label: "Outer radius factor (× width)",
        min: 0.1,
        max: 5,
        step: 0.01
      },
      vertexResolution: {
        component: "slider",
        label: "Polygon vertex resolution",
        min: 3,
        max: 256,
        step: 1
      },
      animationSpeed: {
        component: "slider",
        label: "Animation speed",
        min: -2,
        max: 2,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
