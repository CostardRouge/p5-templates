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
  shapeFormConfiguration,
  blurredBackgroundFormValues,
  blurredBackgroundFormConfiguration
} from "../_options";

export const formValues = {
  shape: shapeFormValues( 150 ),
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
  rotation: rotationFormValues( {
    count: 0.1,
    speed: 0,
    indexMultiplier: 3,
    wobble: 0.5
  } ),
  colors: colorsFormValues( {
    palette: "rainbow"
  } ),
  background: blurredBackgroundFormValues( {
    linesAmount: 141,
    linesWeight: 10,
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
  shape: shapeFormConfiguration(),
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  rotation: rotationFormConfiguration(),
  colors: colorsFormConfiguration(),
  background: blurredBackgroundFormConfiguration(),
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
