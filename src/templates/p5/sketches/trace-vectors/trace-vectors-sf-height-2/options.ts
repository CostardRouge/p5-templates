import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
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
    value: "abcdefghijklmnopqrstuvwxyz"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.66,
    sampleFactor: 0.1,
    sampleFactorMin: 0.025
  },
  grid: {
    show: true,
    columns: 2,
    rows: 4,
    weight: 0.5
  },
  hud: {
    show: true,
    letterRange: 1,
    letterSize: 36,
    margin: 50
  },
  traced: {
    steps: 26,
    weight: 4,
    endpointWeight: 7
  },
  wave: {
    amplitude: 0.5
  },
  colors: {
    hueIndexMultiplier: 6,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 4
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
  letters: lettersForm,
  textStyle: {
    ...textStyleForm,
    fields: {
      ...textStyleForm.fields,
      sampleFactorMin: {
        label: "Sample factor min (oscillation)",
        component: "slider",
        min: 0.005,
        max: 1,
        step: 0.005
      }
    }
  },
  grid: gridForm,
  hud: {
    component: "nested-object",
    label: "Letter HUD (left/right)",
    fields: {
      show: {
        label: "Show?",
        component: "checkbox"
      },
      letterRange: {
        label: "Letter range",
        component: "slider",
        min: 1,
        max: 9,
        step: 1
      },
      letterSize: {
        label: "Letter size",
        component: "slider",
        min: 10,
        max: 200,
        step: 1
      },
      margin: {
        label: "HUD margin",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      }
    }
  },
  traced: {
    ...tracedForm,
    fields: {
      ...tracedForm.fields,
      endpointWeight: {
        label: "Endpoint dot weight",
        component: "slider",
        min: 0,
        max: 30,
        step: 1
      }
    }
  },
  wave: {
    component: "nested-object",
    label: "Vertical wave",
    fields: {
      amplitude: {
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
  },
  title: titleFormConfiguration
};
