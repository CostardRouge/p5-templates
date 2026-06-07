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
    value: "123456789"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.37,
    sampleFactor: 0.5
  },
  grid: {
    show: true,
    columns: 3,
    rows: 3,
    weight: 0.5
  },
  traced: {
    steps: 31,
    weight: 2
  },
  colors: {
    hueIndexMultiplier: 1,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 5
  },
  loop: {
    timeScale: 6.7,
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
