import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  textForm,
  textStyleForm,
  gridForm,
  tracedForm,
  colorsForm,
  loopForm,
  baseDefaults
} from "../_form";

export const formValues = {
  ...baseDefaults,
  text: {
    mode: "single",
    value: "infinite"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    sampleFactor: 0.15,
    size: 0.66
  },
  traced: {
    steps: 16,
    weight: 4
  },
  colors: {
    hueIndexMultiplier: 6,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 3.5
  },
  loop: {
    timeScale: 1.5,
    timeOffset: 0
  },
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  text: textForm,
  textStyle: textStyleForm,
  grid: gridForm,
  traced: tracedForm,
  colors: colorsForm,
  loop: loopForm,
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
