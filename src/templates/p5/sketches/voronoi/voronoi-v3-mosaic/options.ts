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

export const formValues = {
  sites: sitesValues,
  quality: metricValues,
  render: {
    palette: "sunset",
    hueSpeed: 0.25,
    shade: 0.25,
    edgeWidth: 2,
    edgeColor: [
      6,
      6,
      8
    ],
    siteGlow: 0
  },
  interactionMix: interactionMixValues,
  interaction: interactionDefaults,
  backgroundColor: [
    8,
    8,
    10,
    255
  ]
};

export const formConfiguration: Record<string, any> = {
  sites: sitesConfig,
  quality: metricConfig,
  render: {
    label: "Render",
    component: "nested-object",
    fields: {
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      hueSpeed: {
        label: "Hue rotation speed",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      shade: {
        label: "Cell shading (depth)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      edgeWidth: {
        label: "Leading thickness (buffer px)",
        component: "slider",
        min: 1,
        max: 5,
        step: 1
      },
      edgeColor: {
        label: "Leading color",
        component: "color"
      },
      siteGlow: {
        label: "Site glow size (0 = off)",
        component: "slider",
        min: 0,
        max: 80,
        step: 2
      }
    }
  },
  interactionMix: interactionMixConfig,
  interaction: interactionFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
