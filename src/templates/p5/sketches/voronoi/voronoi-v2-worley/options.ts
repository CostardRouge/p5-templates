import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  PALETTE_OPTIONS,
  sitesValues,
  sitesConfig,
  metricValues,
  metricConfig,
  interactionDefaults,
  interactionMixValues,
  interactionMixConfig,
  interactionFormConfiguration
} from "../_options";

const MODE_OPTIONS = [
  {
    label: "F2 − F1 (cracked cells)",
    value: "f2-f1"
  },
  {
    label: "F1 (bubbles)",
    value: "f1"
  },
  {
    label: "F2",
    value: "f2"
  },
  {
    label: "F1 × F2 (soft cells)",
    value: "f1xf2"
  }
];

export const formValues = {
  sites: {
    ...sitesValues,
    count: 36
  },
  quality: metricValues,
  render: {
    mode: "f2-f1",
    palette: "ice",
    grayscale: false,
    invert: false,
    contrast: 1,
    scale: 1,
    hueSpeed: 0
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
  sites: sitesConfig,
  quality: metricConfig,
  render: {
    label: "Render",
    component: "nested-object",
    fields: {
      mode: {
        label: "Cellular mode",
        component: "select",
        options: MODE_OPTIONS
      },
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      grayscale: {
        label: "Grayscale",
        component: "checkbox"
      },
      invert: {
        label: "Invert",
        component: "checkbox"
      },
      contrast: {
        label: "Contrast (gamma)",
        component: "slider",
        min: 0.2,
        max: 5,
        step: 0.05
      },
      scale: {
        label: "Distance scale",
        component: "slider",
        min: 0.2,
        max: 4,
        step: 0.05
      },
      hueSpeed: {
        label: "Hue scroll speed",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
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
