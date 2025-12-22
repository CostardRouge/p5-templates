import titleDefaultValues from "@/p5-sketches/utils/title/titleDefaultValues.js";
import titleFormConfiguration from "@/p5-sketches/utils/title/titleFormConfiguration.js";

export const formValues = {
  images: [
  ],

  margin: 0.1,
  scale: 1,
  center: true,
  clip: false,
  fill: false,

  // Colors (sketch-level overrides; falls back to global options.colors if unset)
  backgroundColor: [
    246,
    235,
    225
  ],

  // Sketch titles
  title: {
    ...titleDefaultValues,
  },
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images",
  },

  margin: {
    label: "Image margin",
    component: "slider",
    min: 0,
    max: 0.45,
    step: 0.005,
  },
  scale: {
    label: "Scale",
    component: "slider",
    min: 0.1,
    max: 4,
    step: 0.1,
  },
  center: {
    label: "Center image",
    component: "checkbox",
  },
  clip: {
    label: "Clip",
    component: "checkbox",
  },
  fill: {
    label: "Fill",
    component: "checkbox",
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color",
  },

  title: {
    ...titleFormConfiguration,
  },
};
