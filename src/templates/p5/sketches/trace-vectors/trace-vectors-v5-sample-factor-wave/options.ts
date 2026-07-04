import {
  textForm,
  textStyleForm,
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
    size: 0.42,
    sampleFactor: 0.2
  },
  layout: {
    marginPx: 384
  },
  traced: {
    steps: 11,
    weight: 9.2
  },
  sampleFactor: {
    values: [
      0.1,
      0.075,
      0.065,
      0.05,
      0.045,
      "0.03",
      0.025
    ]
  },
  extremes: {
    show: true,
    weight: 4.6
  },
  colors: {
    hueIndexMultiplier: 8,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 4
  },
  loop: {
    timeScale: 7.8,
    timeOffset: 0
  }
};

export const formConfiguration: Record<string, any> = {
  text: textForm,
  textStyle: textStyleForm,
  layout: {
    component: "nested-object",
    label: "Layout",
    fields: {
      marginPx: {
        label: "Side margin (px)",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      }
    }
  },
  traced: tracedForm,
  sampleFactor: {
    component: "nested-object",
    label: "Sample factor cycle",
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
  extremes: {
    component: "nested-object",
    label: "Extremity lines",
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
