import {
  gridTraceFormConfiguration,
  gridTraceFormValuesBase
} from "../_grid-form";

export const formValues = {
  ...gridTraceFormValuesBase,
  text: {
    mode: "single",
    value: "123456789"
  },
  textStyle: {
    ...gridTraceFormValuesBase.textStyle,
    sampleFactor: 0.1
  },
  direction: {
    speed: 0.025
  },
  hud: {
    show: true,
    weight: 1,
    margin: 50,
    range: [
      0.5,
      0,
      1
    ]
  },
  colors: {
    ...gridTraceFormValuesBase.colors,
    accentMix: 0.5
  }
};

export const formConfiguration: Record<string, any> = {
  ...gridTraceFormConfiguration,
  direction: {
    component: "nested-object",
    label: "Direction",
    fields: {
      speed: {
        label: "Max speed",
        component: "slider",
        min: 0.001,
        max: 0.5,
        step: 0.001
      }
    }
  },
  hud: {
    component: "nested-object",
    label: "Direction HUD",
    fields: {
      show: {
        label: "Show?",
        component: "checkbox"
      },
      weight: {
        label: "Stroke weight",
        component: "slider",
        min: 0.5,
        max: 5,
        step: 0.1
      },
      margin: {
        label: "Margin (px)",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      }
    }
  }
};
