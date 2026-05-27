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
    value: "xyz"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.66,
    sampleFactor: 0.5
  },
  grid: {
    show: true,
    columns: 3,
    rows: 3,
    weight: 0.5
  },
  traced: {
    steps: 23,
    weight: 10
  },
  chunks: {
    count: 10
  },
  sway: {
    amplitude: 360
  },
  extremes: {
    show: true,
    weight: 4
  },
  colors: {
    hueIndexMultiplier: 8,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 5
  },
  loop: {
    timeScale: 1,
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
  chunks: {
    component: "nested-object",
    label: "Chunks",
    fields: {
      count: {
        label: "Chunks count",
        component: "slider",
        min: 1,
        max: 100,
        step: 1
      }
    }
  },
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
