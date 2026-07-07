import {
  gridTraceFormConfiguration,
  gridTraceFormValuesBase
} from "../_grid-form";

export const formValues = {
  ...gridTraceFormValuesBase,
  text: {
    mode: "single",
    value: "#elastic!"
  },
  textStyle: {
    ...gridTraceFormValuesBase.textStyle,
    sampleFactor: 0.1
  },
  speed: {
    values: [
      0.01,
      0.01,
      0.025,
      0.05,
      0.05,
      0.075,
      0.1,
      0.1,
      0.1,
      0.05
    ]
  },
  hud: {
    show: true,
    weight: 1,
    margin: 50
  },
  colors: {
    ...gridTraceFormValuesBase.colors,
    accentMix: 0.5
  }
};

export const formConfiguration: Record<string, any> = {
  ...gridTraceFormConfiguration,
  hud: {
    component: "nested-object",
    label: "Speed HUD",
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
  },
  speed: {
    component: "nested-object",
    label: "Speed cycle",
    fields: {
      values: {
        label: "Speed values",
        component: "item-list",
        itemConfig: {
          label: "Speed values"
        }
      }
    }
  }
};
