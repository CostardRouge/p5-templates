import {
  linesFormValues,
  linesFormConfiguration,
  opacityFormValues,
  opacityFormConfiguration,
  rotationFormConfiguration,
  colorsFormValues,
  colorsFormConfiguration,
  shapeFormValues,
  shapeFormConfiguration
} from "../_options";

export const formValues = {
  shape: {
    ...shapeFormValues( 350 ),
    radiusGain: 1.5,
    spreadFraction: 0.5,
    lineSpreadFraction: 0.5
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
    linesAmount: 80,
    weight: 5,
    alpha: 60,
    tint: [
      255,
      90,
      80
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
      min: 0.05,
      max: 2,
      step: 0.01
    },
    lineSpreadFraction: {
      component: "slider",
      label: "Line spread (× PI)",
      min: 0.05,
      max: 2,
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
