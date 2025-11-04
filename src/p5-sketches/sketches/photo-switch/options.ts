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
  ] as [number, number, number],
  textColor: [
    0
  ] as [number],

  // Image display
  margin: 80,
  centerImage: true,
  imageScale: 1,
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  // Assets
  images: {
    component: "images-stack",
    label: "Images"
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  textColor: {
    component: "color",
    label: "Text color"
  },

  // Image display
  margin: {
    component: "slider",
    label: "Margin",
    min: 0,
    max: 200,
    step: 1,
  },
  centerImage: {
    component: "checkbox",
    label: "Center image"
  },
  imageScale: {
    component: "slider",
    label: "Image scale",
    min: 0.05,
    max: 3,
    step: 0.01,
  },
};
