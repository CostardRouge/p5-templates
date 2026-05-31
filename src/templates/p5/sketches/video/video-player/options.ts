// Default values only
export const formValues = {
  // Assets — each entry is { id, path, params: { repeat, speed, offset, loopMode } }
  videos: [],

  // Colors
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

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
