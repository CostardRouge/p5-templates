// Default values only
export const formValues = {
  videos: [],

  decay: 0.9,
  zoom: 1,
  rotation: 0,
  blur: 0,
  blendMode: "BLEND",

  backgroundColor: [
    10,
    10,
    12
  ]
};

// UI configuration only
const blendModeOptions = [
  "BLEND",
  "ADD",
  "DARKEST",
  "LIGHTEST",
  "DIFFERENCE",
  "EXCLUSION",
  "MULTIPLY",
  "SCREEN",
  "REPLACE"
].map( ( value ) => ( {
  value,
  label: value
} ) );

export const formConfiguration: Record<string, any> = {
  videos: {
    component: "asset-stack",
    kind: "videos",
    label: "Videos"
  },

  decay: {
    component: "slider",
    label: "Trail persistence",
    min: 0,
    max: 0.99,
    step: 0.01
  },

  zoom: {
    component: "slider",
    label: "Feedback zoom",
    min: 0.9,
    max: 1.1,
    step: 0.005
  },

  rotation: {
    component: "slider",
    label: "Feedback rotation (deg/frame)",
    min: -5,
    max: 5,
    step: 0.1
  },

  blur: {
    component: "slider",
    label: "Blur",
    min: 0,
    max: 6,
    step: 1
  },

  blendMode: {
    component: "select",
    label: "Blend mode",
    options: blendModeOptions
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
