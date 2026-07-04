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
    value: "0123456789"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.66,
    sampleFactor: 0.1
  },
  traced: {
    steps: 60,
    weight: 4
  },
  hud: {
    showWaveform: true,
    showLetters: true,
    letterRange: 1,
    letterSize: 36,
    margin: 50,
    waveformSteps: 150,
    waveformWeight: 4
  },
  wave: {
    amplitudeDivisor: 5
  },
  colors: {
    hueIndexMultiplier: 6,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 4
  },
  grid: {
    show: true,
    columns: 20,
    rows: 26,
    weight: 0.5
  },
  loop: {
    timeScale: 2,
    timeOffset: 0
  }
};

export const formConfiguration: Record<string, any> = {
  text: textForm,
  letters: lettersForm,
  textStyle: textStyleForm,
  hud: {
    component: "nested-object",
    label: "HUD",
    fields: {
      showWaveform: {
        label: "Show waveform?",
        component: "checkbox"
      },
      showLetters: {
        label: "Show letters?",
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
      },
      waveformSteps: {
        label: "Waveform steps",
        component: "slider",
        min: 10,
        max: 400,
        step: 1
      },
      waveformWeight: {
        label: "Waveform stroke weight",
        component: "slider",
        min: 0.5,
        max: 10,
        step: 0.1
      }
    }
  },
  wave: {
    component: "nested-object",
    label: "Wave on traced lines",
    fields: {
      amplitudeDivisor: {
        label: "Amplitude divisor (H / d)",
        component: "slider",
        min: 1,
        max: 20,
        step: 0.1
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
  }
};
