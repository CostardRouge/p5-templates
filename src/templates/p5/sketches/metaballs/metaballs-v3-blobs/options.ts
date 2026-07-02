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
  balls: {
    ...ballsValues,
    radiusPulse: 0.2
  },
  grid: {
    ...gridValues,
    cellSize: 12
  },
  fill: {
    gradient: true,
    palette: "sunset",
    hueSpeed: 0.5,
    color: [
      120,
      180,
      255,
      255
    ]
  },
  outline: {
    weight: 5.5,
    glow: 0,
    color: [
      255,
      255,
      255,
      255
    ]
  },
  interactionMix: interactionMixValues,
  interaction: interactionDefaults,
  backgroundColor: [
    6,
    4,
    12,
    255
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  balls: ballsConfig,
  grid: gridConfig,
  fill: {
    label: "Blob fill",
    component: "nested-object",
    fields: {
      gradient: {
        label: "Vertical gradient",
        component: "checkbox"
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
        max: 5,
        step: 0.1
      },
      color: {
        label: "Solid fill (gradient off)",
        component: "color"
      }
    }
  },
  outline: {
    label: "Outline & glow",
    component: "nested-object",
    fields: {
      weight: {
        label: "Outline weight",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.5
      },
      glow: {
        label: "Glow layers",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      color: {
        label: "Outline color",
        component: "color"
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
