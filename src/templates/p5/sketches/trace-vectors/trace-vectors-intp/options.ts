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
    value: "intp"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.52,
    sampleFactor: 0.1
  },
  grid: {
    show: true,
    columns: 4,
    rows: 2,
    weight: 0.5
  },
  traced: {
    steps: 24,
    weight: 3
  },
  sampleFactor: {
    values: [
      0.1,
      0.075,
      0.05,
      0.025,
      0.15
    ]
  },
  colors: {
    hueIndexMultiplier: 6,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 5
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
  sampleFactor: {
    component: "nested-object",
    label: "Hue/sample factor cycle",
    fields: {
      values: {
        label: "Cycle values",
        component: "item-list",
        itemConfig: {
          label: "Sample factor values"
        }
      }
    }
  },
  colors: colorsForm,
  loop: loopForm,
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
