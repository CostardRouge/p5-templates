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
    cellSize: 4,
    interpolate: gridValues.interpolate
  },
  bands: {
    count: 8,
    minLevel: 1.05,
    maxLevel: 12,
    palette: "rainbow",
    hueSpeed: 0,
    fill: false,
    lines: true,
    lineWeight: 5
  },
  interactionMix: interactionMixValues,
  interaction: interactionDefaults,
  backgroundColor: [
    4,
    6,
    16,
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
    label: "Marching grid",
    component: "nested-object",
    fields: {
      cellSize: gridConfig.fields.cellSize,
      interpolate: gridConfig.fields.interpolate
    }
  },
  bands: {
    label: "Contour bands",
    component: "nested-object",
    fields: {
      count: {
        label: "Band count",
        component: "slider",
        min: 1,
        max: 24,
        step: 1
      },
      minLevel: {
        label: "Outer level (lowest)",
        component: "slider",
        min: 0.05,
        max: 2,
        step: 0.05
      },
      maxLevel: {
        label: "Inner level (highest)",
        component: "slider",
        min: 0.5,
        max: 12,
        step: 0.1
      },
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      hueSpeed: {
        label: "Hue scroll speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      fill: {
        label: "Fill bands",
        component: "checkbox"
      },
      lines: {
        label: "Show contour lines",
        component: "checkbox"
      },
      lineWeight: {
        label: "Line weight",
        component: "slider",
        min: 0.5,
        max: 8,
        step: 0.5
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
