import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
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
    ...shapeFormValues( 200 ),
    foldCycle: [
      1,
      1.5,
      2,
      2,
      2.5,
      3,
      3.5,
      3.5,
      4,
      4,
      4
    ],
    foldLerp: 0.0005,
    radiusGain: 1.5
  },
  lines: linesFormValues( {
    length: 190,
    weight: 110,
    maxCount: 3
  } ),
  opacity: opacityFormValues( {
    pingPong: true,
    speed: 2,
    groupCount: 1,
    startFactor: 12
  } ),
  colors: colorsFormValues( {
    palette: "rainbow"
  } ),
  rotation: {
    speed: 0.5
  },
  background: blurredBackgroundFormValues( {
    linesAmount: 90,
    linesWeight: 8,
    animationSpeed: 0.25
  } ),
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
      min: 0.0001,
      max: 0.1,
      step: 0.0001
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
  colors: colorsFormConfiguration(),
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      speed: {
        component: "slider",
        label: "Rotation speed",
        min: -3,
        max: 3,
        step: 0.01
      }
    }
  },
  background: blurredBackgroundFormConfiguration(),
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
