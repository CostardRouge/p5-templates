import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
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
    value: "0123456789"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.66,
    sampleFactor: 0.4
  },
  grid: {
    show: true,
    columns: 5,
    rows: 4,
    weight: 0.5,
    skipX: [
      1,
      2
    ],
    skipY: []
  },
  hud: {
    show: true,
    letterRange: 2,
    letterSize: 36,
    margin: 50
  },
  traced: {
    steps: 23,
    weight: 4
  },
  extremes: {
    show: true,
    weight: 3
  },
  colors: {
    hueIndexMultiplier: 8,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 4
  },
  loop: {
    timeScale: 4,
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
  grid: {
    component: "nested-object",
    label: "Background grid",
    fields: {
      show: {
        label: "Show?",
        component: "checkbox"
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      weight: {
        label: "Line weight",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      skipX: {
        label: "Skip X (column indexes)",
        component: "item-list",
        itemConfig: {
          label: "Skip X"
        }
      },
      skipY: {
        label: "Skip Y (row indexes)",
        component: "item-list",
        itemConfig: {
          label: "Skip Y"
        }
      }
    }
  },
  hud: {
    component: "nested-object",
    label: "Letter HUD (3-letter)",
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
  traced: tracedForm,
  extremes: {
    component: "nested-object",
    label: "Extremity dots",
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
