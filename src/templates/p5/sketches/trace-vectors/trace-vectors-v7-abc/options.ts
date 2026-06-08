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
    value: "abc"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.34,
    sampleFactor: 0.15
  },
  grid: {
    show: true,
    columns: 3,
    rows: 3,
    weight: 0.5
  },
  traced: {
    steps: 77,
    weight: 3
  },
  sway: {
    amplitude: 360
  },
  extremes: {
    show: true,
    weight: 4
  },
  colors: {
    hueIndexMultiplier: 16,
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
  grid: gridForm,
  traced: tracedForm,
  sway: {
    component: "nested-object",
    label: "Horizontal sway",
    fields: {
      amplitude: {
        label: "Amplitude (px)",
        component: "slider",
        min: 0,
        max: 800,
        step: 1
      }
    }
  },
  extremes: {
    component: "nested-object",
    label: "Extremity loops",
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
