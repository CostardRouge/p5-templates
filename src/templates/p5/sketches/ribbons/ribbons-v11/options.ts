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

const rotationFields = {
  speed: {
    component: "slider",
    label: "Rotation speed (snaps to whole turns/loop)",
    min: -3,
    max: 3,
    step: 0.01
  }
};

export const formValues = {
  shape: {
    ...shapeFormValues( 220 ),
    foldCycle: [
      1,
      2,
      2,
      3,
      3,
      4,
      4,
      5
    ],
    foldLerp: 0.0005
  },
  lines: linesFormValues( {
    length: 190,
    weight: 110,
    maxCount: 3,
    regularLength: true
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
    }
  } ),
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  colors: colorsFormConfiguration(),
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: rotationFields
  },
  background: blurredBackgroundFormConfiguration(),
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
