const paletteOptions = [
  "rainbow",
  "rainbowCrazy",
  "darkBlueYellow",
  "purple",
  "purpleSimple",
  "green",
  "black"
].map( ( value ) => ( {
  value,
  label: value
} ) );

export const formValues = {
  backgroundColor: [
    0,
    0,
    0
  ],
  palette: "rainbow",
  columns: 9,
  proportional: true,
  rows: 9,
  size: 18,
  amount: 2,
  strokeWeight: 3,
  opacityFactor: 1.5,
  hueMultiplier: 3,
  rotationSpeed: 1
};

export const formConfiguration: Record<string, any> = {
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  palette: {
    component: "select",
    label: "Palette",
    options: paletteOptions
  },
  columns: {
    label: "Columns",
    component: "slider",
    min: 1,
    max: 80,
    step: 1
  },
  proportional: {
    label: "Proportional rows?",
    component: "checkbox"
  },
  rows: {
    label: "Rows",
    component: "slider",
    min: 1,
    max: 120,
    step: 1
  },
  size: {
    label: "Cross size",
    component: "slider",
    min: 1,
    max: 120,
    step: 1
  },
  amount: {
    label: "Branches (2 = plus, 3 = asterisk)",
    component: "slider",
    min: 1,
    max: 8,
    step: 1
  },
  strokeWeight: {
    label: "Line weight",
    component: "slider",
    min: 0.1,
    max: 20,
    step: 0.1
  },
  opacityFactor: {
    label: "Opacity factor",
    component: "slider",
    min: 0.5,
    max: 6,
    step: 0.1
  },
  hueMultiplier: {
    label: "Hue spread",
    component: "slider",
    min: 0,
    max: 12,
    step: 0.1
  },
  rotationSpeed: {
    label: "Rotation speed (whole turns / loop)",
    component: "slider",
    min: 0,
    max: 6,
    step: 1
  }
};
