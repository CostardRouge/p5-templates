import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
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
    ...shapeFormValues( 300 ),
    foldCycle: [
      1,
      0.75,
      1.5,
      1
    ],
    foldLerp: 0.1,
    jitter: 15,
    jitterFreq: 7,
    spreadFraction: 0.5
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
    palette: "red"
  } ),
  background: {
    linesAmount: 90,
    weight: 4,
    alpha: 40,
    tint: [
      255,
      90,
      80
    ] as number[],
    animationSpeed: 0.5,
    radiusXMult: 2,
    radiusYMult: 2
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ] as number[],
  title: {
    ...titleDefaultValues,
    show: false
  }
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
    jitter: {
      component: "slider",
      label: "Vertex jitter",
      min: 0,
      max: 100,
      step: 0.5
    },
    jitterFreq: {
      component: "slider",
      label: "Jitter frequency",
      min: 0,
      max: 30,
      step: 0.1
    },
    spreadFraction: {
      component: "slider",
      label: "Shape spread (× PI)",
      min: 0.05,
      max: 2,
      step: 0.01
    }
  } ),
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  rotation: rotationFormConfiguration(),
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
  },
  title: titleFormConfiguration
};
