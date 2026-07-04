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
    value: "xy"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.54,
    sampleFactor: 0.15
  },
  grid: {
    show: true,
    columns: 3,
    rows: 1,
    weight: 0.5
  },
  traced: {
    steps: 21,
    weight: 1,
    endpointWeight: 5
  },
  sampleFactor: {
    values: [
      0.1,
      0.075,
      0.05,
      0.025,
      0.3
    ]
  },
  wave: {
    applyY: true,
    applyZ: true,
    zAmplitude: 1.43
  },
  colors: {
    hueIndexMultiplier: 8,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 4
  },
  loop: {
    timeScale: 1.5,
    timeOffset: 0
  }
};

export const formConfiguration: Record<string, any> = {
  text: textForm,
  textStyle: textStyleForm,
  grid: gridForm,
  traced: {
    ...tracedForm,
    fields: {
      ...tracedForm.fields,
      endpointWeight: {
        label: "Endpoint dot weight",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      }
    }
  },
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
  wave: {
    component: "nested-object",
    label: "Z / Y wave on vectors",
    fields: {
      applyY: {
        label: "Apply on Y?",
        component: "checkbox"
      },
      applyZ: {
        label: "Apply on Z?",
        component: "checkbox"
      },
      zAmplitude: {
        label: "Amplitude (× H)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
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
