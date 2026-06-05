// Default values only
export const formValues = {
  videos: [],

  segments: 8,
  autoSpin: true,
  rotation: 0,
  sourceZoom: 0.5,
  sourceOffsetX: 0,
  sourceOffsetY: 0,

  backgroundColor: [
    10,
    10,
    12
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  videos: {
    component: "asset-stack",
    kind: "videos",
    label: "Videos"
  },

  segments: {
    component: "slider",
    label: "Segments",
    min: 2,
    max: 24,
    step: 2
  },

  autoSpin: {
    component: "checkbox",
    label: "Auto spin"
  },

  rotation: {
    component: "slider",
    label: "Rotation (deg)",
    min: 0,
    max: 360,
    step: 1
  },

  sourceZoom: {
    component: "slider",
    label: "Source zoom",
    min: 0.5,
    max: 3,
    step: 0.05
  },

  sourceOffsetX: {
    component: "slider",
    label: "Source offset X",
    min: -1,
    max: 1,
    step: 0.01
  },

  sourceOffsetY: {
    component: "slider",
    label: "Source offset Y",
    min: -1,
    max: 1,
    step: 0.01
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
