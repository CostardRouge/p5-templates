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
      1,
      1.5,
      2.5,
      1
    ],
    foldLerp: 0.05,
    radiusGain: 1.5
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
  rotation: {
    count: 1,
    speed: 1,
    drift: 0.75,
    indexMultiplier: 2,
    timeMultiplier: 2
  },
  colors: colorsFormValues( {
    palette: "red"
  } ),
  background: {
    linesAmount: 60,
    weight: 6,
    alpha: 48,
    tint: [
      128,
      128,
      255
    ] as number[],
    animationSpeed: 0.5,
    radiusXMult: 1.5,
    radiusYMult: 2
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
    }
  } ),
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  rotation: rotationFormConfiguration( {
    drift: {
      component: "slider",
      label: "Drift speed",
      min: -5,
      max: 5,
      step: 0.01
    },
    timeMultiplier: {
      component: "slider",
      label: "Time multiplier",
      min: -5,
      max: 5,
      step: 0.01
    }
  } ),
  colors: colorsFormConfiguration(),
  background: {
    component: "nested-object",
    label: "Radial background",
    fields: {
      linesAmount: {
        component: "slider",
        label: "Lines amount",
        min: 1,
        max: 600,
        step: 1
      },
      weight: {
        component: "slider",
        label: "Weight",
        min: 1,
        max: 30,
        step: 0.5
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
      animationSpeed: {
        component: "slider",
        label: "Animation speed",
        min: -3,
        max: 3,
        step: 0.01
      },
      radiusXMult: {
        component: "slider",
        label: "Radius X mult",
        min: 0,
        max: 5,
        step: 0.01
      },
      radiusYMult: {
        component: "slider",
        label: "Radius Y mult",
        min: 0,
        max: 5,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
