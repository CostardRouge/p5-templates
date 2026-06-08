import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
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
    mode: "multiple",
    value: [
      "up",
      "down"
    ]
  },
  textStyle: {
    ...baseDefaults.textStyle,
    size: 0.28,
    sampleFactor: 0.12
  },
  layout: {
    marginDivisor: 1.3
  },
  grid: {
    show: true,
    columns: 1,
    rows: 10,
    weight: 0.5
  },
  qualityLine: {
    show: true,
    weight: 2
  },
  traced: {
    steps: 111,
    weight: 3
  },
  wave: {
    zValues: [
      -50,
      20,
      -100,
      50,
      20,
      100
    ]
  },
  colors: {
    hueIndexMultiplier: 16,
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
  textStyle: textStyleForm,
  layout: {
    component: "nested-object",
    label: "Layout",
    fields: {
      marginDivisor: {
        label: "Margin divisor (letterSize/d)",
        component: "slider",
        min: 0.5,
        max: 6,
        step: 0.1
      }
    }
  },
  qualityLine: {
    component: "nested-object",
    label: "Quality line",
    fields: {
      show: {
        label: "Show?",
        component: "checkbox"
      },
      weight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      }
    }
  },
  grid: gridForm,
  traced: tracedForm,
  wave: {
    component: "nested-object",
    label: "Z wave",
    fields: {
      zValues: {
        label: "Z values (rotated through)",
        component: "item-list",
        itemConfig: {
          label: "Z values"
        }
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
