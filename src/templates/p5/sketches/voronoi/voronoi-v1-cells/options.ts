import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  PALETTE_OPTIONS,
  sitesValues,
  sitesConfig,
  metricValues,
  metricConfig
} from "../_options";

export const formValues = {
  sites: sitesValues,
  quality: metricValues,
  render: {
    palette: "rainbow",
    hueSpeed: 0,
    shade: 0.5,
    edgeStrength: 0.85,
    edgeColor: [
      10,
      10,
      14
    ],
    showSites: false
  },
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
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      hueSpeed: {
        label: "Hue scroll speed",
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
      edgeStrength: {
        label: "Edge strength",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      edgeColor: {
        label: "Edge color",
        component: "color"
      },
      showSites: {
        label: "Show site points",
        component: "checkbox"
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
