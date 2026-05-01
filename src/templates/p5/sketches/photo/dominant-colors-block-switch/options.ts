import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  // Assets
  images: [
  ],

  // Colors (sketch-level overrides; falls back to global options.colors if unset)
  backgroundColor: [
    0,
    0,
    0
  ],

  // Grid
  rows: 16,
  columns: 9,
  borderSize: 0,

  // Image processing
  dominantColorSample: 50,

  title: titleDefaultValues
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  // Assets
  images: {
    component: "images-stack",
    label: "Images",
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
  textColor: {
    component: "color",
    label: "Text color",
  },

  // Grid
  rows: {
    component: "slider",
    label: "Grid rows",
    min: 1,
    max: 64,
    step: 1,
  },
  columns: {
    component: "slider",
    label: "Grid columns",
    min: 1,
    max: 64,
    step: 1,
  },
  borderSize: {
    component: "slider",
    label: "Border size",
    min: 0,
    max: 200,
    step: 1,
  },

  // Image processing
  dominantColorSample: {
    component: "slider",
    label: "Dominant color sample size",
    min: 2,
    max: 200,
    step: 1,
  },

  title: titleFormConfiguration,
};
