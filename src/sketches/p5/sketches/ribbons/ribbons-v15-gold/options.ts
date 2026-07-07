import {
  linesFormValues,
  linesFormConfiguration,
  opacityFormValues,
  opacityFormConfiguration,
  colorsFormValues,
  colorsFormConfiguration,
  shapeFormValues,
  shapeFormConfiguration,
  blurredBackgroundFormValues,
  blurredBackgroundFormConfiguration
} from "../_options";

export const formValues = {
  shape: {
    ...shapeFormValues( 80 ),
    foldCycle: [
      1.5,
      1.5,
      2,
      2.5,
      3,
      0.5,
      0.5,
      0.5
    ],
    foldLerp: 0.05,
    radiusGain: 1.55,
    spreadFraction: 1 / 6
  },
  lines: linesFormValues( {
    length: 250,
    weight: 250,
    maxCount: 3
  } ),
  opacity: opacityFormValues( {
    pingPong: true,
    speed: 2,
    groupCount: 1,
    startFactor: 10
  } ),
  rotation: {
    wobble: 1,
    speed: 1
  },
  colors: colorsFormValues( {
    palette: "gold"
  } ),
  background: blurredBackgroundFormValues( {
    pixelDensity: 0.05,
    blur: 4,
    linesAmount: 60,
    linesWeight: 6,
    tint: [
      255,
      225,
      0
    ] as number[],
    animationSpeed: 0.25,
    sinFreq: 5,
    cosFreq: 8,
    cosWeight: 2,
    cosOffset: 2
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
    foldLerp: {
      component: "slider",
      label: "Fold lerp (smoothing)",
      min: 0.001,
      max: 0.5,
      step: 0.001
    },
    radiusGain: {
      component: "slider",
      label: "Radius gain",
      min: 0.1,
      max: 5,
      step: 0.01
    },
    spreadFraction: {
      component: "slider",
      label: "Shape spread (× PI)",
      min: 0.01,
      max: 1,
      step: 0.01
    }
  } ),
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      wobble: {
        component: "slider",
        label: "Wobble amplitude",
        min: -3,
        max: 3,
        step: 0.01
      },
      speed: {
        component: "slider",
        label: "Rotation speed",
        min: -3,
        max: 3,
        step: 0.01
      }
    }
  },
  colors: colorsFormConfiguration(),
  background: blurredBackgroundFormConfiguration( {
    sinFreq: {
      component: "slider",
      label: "Coupled sin frequency",
      min: 0,
      max: 30,
      step: 0.1
    },
    cosFreq: {
      component: "slider",
      label: "Coupled cos frequency",
      min: 0,
      max: 30,
      step: 0.1
    },
    cosWeight: {
      component: "slider",
      label: "Coupled cos weight",
      min: 0,
      max: 10,
      step: 0.01
    },
    cosOffset: {
      component: "slider",
      label: "Coupled cos offset",
      min: 0,
      max: 10,
      step: 0.01
    }
  } ),
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
