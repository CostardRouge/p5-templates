import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  PALETTE_OPTIONS,
  ballsValues,
  ballsConfig,
  gridValues,
  gridConfig,
  interactionDefaults,
  interactionMixValues,
  interactionMixConfig,
  interactionFormConfiguration
} from "../_options";

export const formValues = {
  balls: ballsValues,
  grid: {
    threshold: 1.35
  },
  render: {
    palette: "magma",
    resolution: 300,
    gamma: 1.45,
    insideBoost: 0.25,
    outsideDim: 0.55,
    showBalls: true
  },
  interactionMix: interactionMixValues,
  interaction: interactionDefaults,
  backgroundColor: [
    0,
    0,
    0,
    255
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  balls: ballsConfig,
  grid: {
    label: "Field",
    component: "nested-object",
    fields: {
      threshold: gridConfig.fields.threshold
    }
  },
  render: {
    label: "Render",
    component: "nested-object",
    fields: {
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      resolution: {
        label: "Resolution (buffer columns)",
        component: "slider",
        min: 40,
        max: 540,
        step: 10
      },
      gamma: {
        label: "Contrast (gamma)",
        component: "slider",
        min: 0.3,
        max: 4,
        step: 0.05
      },
      insideBoost: {
        label: "Inside brightness boost",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      outsideDim: {
        label: "Outside dim",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      showBalls: {
        label: "Show ball outlines",
        component: "checkbox"
      }
    }
  },
  interactionMix: interactionMixConfig,
  interaction: interactionFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
