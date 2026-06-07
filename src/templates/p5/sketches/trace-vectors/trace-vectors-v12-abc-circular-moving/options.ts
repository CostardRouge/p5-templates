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
    value: "i.n.f.i.n.i.t.e."
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.66,
    sampleFactor: 0.18
  },
  grid: {
    show: true,
    columns: 3,
    rows: 3,
    weight: 0.5,
    showCellLabels: true,
    cellLabelSize: 22,
    labels: "infinite."
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
    steps: 12,
    weight: 4
  },
  extremes: {
    show: true,
    weight: 4
  },
  colors: {
    hueIndexMultiplier: 8,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 2.5
  },
  loop: {
    timeScale: 6.6,
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
      },
      labels: {
        label: "Per-cell labels (text)",
        component: "text"
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
  },
  title: titleFormConfiguration
};
