import {
  textForm,
  textStyleForm,
  gridForm,
  tracedForm,
  colorsForm,
  loopForm,
  lettersForm,
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
    weight: 16.3
  },
  colors: {
    hueIndexMultiplier: 6,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 3.5
  },
  loop: {
    timeScale: 2.2,
    timeOffset: 0
  }
};

export const formConfiguration: Record<string, any> = {
  text: textForm,
  letters: lettersForm,
  textStyle: textStyleForm,
  grid: gridForm,
  traced: tracedForm,
  colors: colorsForm,
  loop: loopForm,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
