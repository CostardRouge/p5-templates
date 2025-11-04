// Values only
export const formValues = {
  // Assets
  images: [
  ],

  // Colors
  backgroundColor: [
    246,
    235,
    225
  ],
  textColor: [
    0
  ],

  // Typography
  font: "martian",

  // Title
  title: "",
  showTitle: true,
  titleSize: 128,
  titleProgressStart: 0.0,
  titleProgressEnd: 0.2,
  titleBlendMode: "exclusion",

  // Circle layout
  anchorXFactor: 0.5,
  anchorYFactor: 0.75,
  radiusXFactor: 0.5, // vs height
  radiusYFactor: 0.5, // vs width
  startAngleDeg: 270,
  endAngleDeg: 90,

  // Image drawing
  imageScale: 0.5,
  centerImage: true,

  // Debug
  showDebugPoints: false,
  debugPointWeight: 20,
  debugPointColor: [
    255,
    0,
    0
  ],
};

// UI config only
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

  // Typography
  font: {
    component: "text", // or "select" if you enumerate string.fonts
    label: "Font (string.fonts key)",
    placeholder: "martian",
  },

  // Title
  title: {
    component: "text",
    label: "Custom title (empty → default)"
  },
  showTitle: {
    component: "checkbox",
    label: "Show title"
  },
  titleSize: {
    component: "slider",
    label: "Title size",
    min: 12,
    max: 300,
    step: 1
  },
  titleProgressStart: {
    component: "slider",
    label: "Title visible from",
    min: 0,
    max: 1,
    step: 0.001,
  },
  titleProgressEnd: {
    component: "slider",
    label: "Title visible to",
    min: 0,
    max: 1,
    step: 0.001,
  },
  titleBlendMode: {
    component: "select",
    label: "Title blend mode",
    options: [
      "blend",
      "darkest",
      "lightest",
      "difference",
      "multiply",
      "exclusion",
      "screen",
      "overlay",
      "hard_light",
      "soft_light",
      "dodge",
      "burn",
      "add",
      "subtract",
    ].map( ( v ) => ( {
      value: v,
      label: v
    } ) ),
  },

  // Circle layout
  anchorXFactor: {
    component: "slider",
    label: "Anchor X (0–1)",
    min: 0,
    max: 1,
    step: 0.001,
  },
  anchorYFactor: {
    component: "slider",
    label: "Anchor Y (0–1)",
    min: 0,
    max: 1,
    step: 0.001,
  },
  radiusXFactor: {
    component: "slider",
    label: "Radius X factor (vs height)",
    min: 0,
    max: 1,
    step: 0.001,
  },
  radiusYFactor: {
    component: "slider",
    label: "Radius Y factor (vs width)",
    min: 0,
    max: 1,
    step: 0.001,
  },
  startAngleDeg: {
    component: "slider",
    label: "Start angle (deg)",
    min: -720,
    max: 720,
    step: 1,
  },
  endAngleDeg: {
    component: "slider",
    label: "End angle (deg)",
    min: -720,
    max: 720,
    step: 1,
  },

  // Image drawing
  imageScale: {
    component: "slider",
    label: "Image scale",
    min: 0.05,
    max: 2,
    step: 0.01,
  },
  centerImage: {
    component: "checkbox",
    label: "Center image"
  },

  // Debug
  showDebugPoints: {
    component: "checkbox",
    label: "Show debug points"
  },
  debugPointWeight: {
    component: "slider",
    label: "Debug point weight",
    min: 1,
    max: 40,
    step: 1,
  },
  debugPointColor: {
    component: "color",
    label: "Debug point color"
  },
};
