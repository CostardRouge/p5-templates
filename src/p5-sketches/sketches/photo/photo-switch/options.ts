import titleDefaultValues from "@/p5-sketches/utils/title/titleDefaultValues.js";
import titleFormConfiguration from "@/p5-sketches/utils/title/titleFormConfiguration.js";

// Default values only
export const formValues = {
  // Assets
  images: [
  ],

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

  // Image display
  margin: 80,
  centerImage: true,
  imageScale: 1,
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
  // Image display
  image: {
    label: "Images",
    component: "nested-object",
    fields: {
      images: {
        component: "images-stack",
        label: "Images",
      },
      margin: {
        component: "slider",
        label: "Margin",
        min: 0,
        max: 200,
        step: 1,
      },
      center: {
        component: "checkbox",
        label: "Center",
      },
      scale: {
        component: "slider",
        label: "Scale",
        min: 0.05,
        max: 3,
        step: 0.01,
      },
    },
  },

  // Sketch title
  title: {
    ...titleFormConfiguration,
  },
};
