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
    value: "123"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.66,
    sampleFactor: 0.1
  },
  grid: {
    show: true,
    columns: 3,
    rows: 1,
    weight: 0.5
  },
  qualityLine: {
    show: true,
    weight: 2
  },
  traced: {
    steps: 21,
    weight: 3
  },
  extremes: {
    show: true,
    weight: 3
  },
  colors: {
    hueIndexMultiplier: 8,
    hueOffset: 0,
    opacityMin: 1.2,
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
  grid: gridForm,
  qualityLine: {
    component: "nested-object",
    label: "Quality line",
    fields: {
      show: {
        label: "Show?",
        component: "checkbox"
      },
      weight: {
        label: "Stroke weight",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      }
    }
  },
  traced: tracedForm,
  extremes: {
    component: "nested-object",
    label: "Extremity points",
    fields: {
      show: {
        label: "Show?",
        component: "checkbox"
      },
      weight: {
        label: "Stroke weight",
        component: "slider",
        min: 0.5,
        max: 16,
        step: 0.1
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
