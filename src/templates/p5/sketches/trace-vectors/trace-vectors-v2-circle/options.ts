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
    value: "0123456789"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.66,
    sampleFactor: 0.1
  },
  circle: {
    radius: 150,
    scale: 1.5
  },
  traced: {
    steps: 20,
    weight: 4
  },
  colors: {
    hueIndexMultiplier: 6,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 5
  },
  loop: {
    timeScale: 2,
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
  circle: {
    component: "nested-object",
    label: "Circle",
    fields: {
      radius: {
        label: "Radius",
        component: "slider",
        min: 0,
        max: 800,
        step: 1
      },
      scale: {
        label: "Scale",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.01
      }
    }
  },
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
