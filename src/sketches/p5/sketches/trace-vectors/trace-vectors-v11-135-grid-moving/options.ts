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
    value: "123456789"
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.34,
    sampleFactor: 0.5
  },
  grid: {
    show: true,
    columns: 3,
    rows: 3,
    weight: 0.5,
    showCellLabels: true,
    cellLabelSize: 14
  },
  path: {
    cellIndexes: [
      1,
      5,
      7,
      3
    ]
  },
  traced: {
    steps: 5,
    weight: 5
  },
  extremes: {
    show: true,
    weight: 4.4
  },
  colors: {
    hueIndexMultiplier: 16,
    hueOffset: 0,
    opacityMin: 1.7,
    opacityMax: 2.1
  },
  loop: {
    timeScale: 1,
    timeOffset: 0
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
        label: "Show grid?",
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
      showCellLabels: {
        label: "Show cell labels?",
        component: "checkbox"
      },
      cellLabelSize: {
        label: "Cell label size",
        component: "slider",
        min: 6,
        max: 80,
        step: 1
      }
    }
  },
  path: {
    component: "nested-object",
    label: "Position path (cell indexes)",
    fields: {
      cellIndexes: {
        label: "Cell index sequence (0-indexed)",
        component: "item-list",
        itemConfig: {
          label: "Cell indexes"
        }
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
  }
};
