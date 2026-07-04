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
    size: 0.3,
    sampleFactor: 0.05
  },
  grid: {
    show: true,
    columns: 3,
    rows: 3,
    weight: 0.5
  },
  traced: {
    steps: 95,
    weight: 7.9
  },
  sway: {
    amplitude: 350
  },
  extremes: {
    show: true,
    weight: 10.6
  },
  colors: {
    hueIndexMultiplier: 16,
    hueOffset: 2.98840734641021,
    opacityMin: 1.5,
    opacityMax: 5
  },
  loop: {
    timeScale: 16,
    timeOffset: 11.4
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
  }
};
