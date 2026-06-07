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
    size: 0.32,
    sampleFactor: 0.3
  },
  grid: {
    show: true,
    columns: 3,
    rows: 3,
    weight: 0.5
  },
  trajectory: {
    show: true,
    weight: 2,
    dotInterval: 0.05
  },
  traced: {
    steps: 13,
    weight: 3.9
  },
  extremes: {
    show: true,
    weight: 6.2
  },
  colors: {
    hueIndexMultiplier: 13.5,
    hueOffset: -1.93159265358979,
    opacityMin: 1.2,
    opacityMax: 5
  },
  loop: {
    timeScale: 10,
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
  trajectory: {
    component: "nested-object",
    label: "Trajectory dots",
    fields: {
      show: {
        label: "Show?",
        component: "checkbox"
      },
      weight: {
        label: "Dot weight",
        component: "slider",
        min: 0.5,
        max: 16,
        step: 0.1
      },
      dotInterval: {
        label: "Dot interval",
        component: "slider",
        min: 0.005,
        max: 0.5,
        step: 0.005
      }
    }
  },
  traced: tracedForm,
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
