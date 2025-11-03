export const formValues = {
  // Text
  title: "500",
  font: "martian", // key in string.fonts

  // Colors
  background: [
    0
  ], // matches options.colors.background style (grayscale or [r,g,b,(a)])

  // Grid
  rows: 25,
  columns: 300,
  centered: true,

  // Noise
  noiseOctaves: 3,
  noiseFalloff: 0.45,

  // Animation/speeds
  timeSpeed: 1, // multiplies `time` everywhere it’s used
  xOffScale: 1.5, // scales x offset (x/width * xOffScale)
  yOffScale: 1.5, // scales y offset (y/height * yOffScale)

  // Geometry
  angleRange: 1, // multiplies [-TAU, TAU] => [-TAU*angleRange, TAU*angleRange]
  scale: 1,

  // Stroke weight mapping
  weightMin: 150,
  weightMax: 200,

  // Color palette + styling
  palette: "rainbow", // "rainbow" | "purple" (maps to colors[palette])
  hueOffset: 0, // passed to palette
  opacityFactorFrom: 2, // maps noise 0..1 -> [from..to]
  opacityFactorTo: 1,

  // Title text sizing
  textSizeDivisor: 6 // text size = (w + h) / textSizeDivisor
};

export const formConfiguration: Record<string, any> = {
  // Text
  title: {
    component: "text",
    label: "Title"
  },
  font: {
    component: "text", // switch to "select" if you enumerate string.fonts keys
    label: "Font (string.fonts key)",
    placeholder: "martian"
  },

  // Colors
  background: {
    component: "color",
    label: "Background color"
  },

  // Grid
  rows: {
    component: "slider",
    label: "Rows",
    min: 1,
    max: 300,
    step: 1
  },
  columns: {
    component: "slider",
    label: "Columns",
    min: 1,
    max: 800,
    step: 1
  },
  centered: {
    component: "checkbox",
    label: "Center grid"
  },

  // Noise
  noiseOctaves: {
    component: "slider",
    label: "Noise octaves",
    min: 1,
    max: 8,
    step: 1
  },
  noiseFalloff: {
    component: "slider",
    label: "Noise falloff",
    min: 0,
    max: 1,
    step: 0.01
  },

  // Animation/speeds
  timeSpeed: {
    component: "slider",
    label: "Time speed",
    min: 0,
    max: 3,
    step: 0.01
  },
  xOffScale: {
    component: "slider",
    label: "X offset scale",
    min: 0,
    max: 4,
    step: 0.01
  },
  yOffScale: {
    component: "slider",
    label: "Y offset scale",
    min: 0,
    max: 4,
    step: 0.01
  },

  // Geometry
  angleRange: {
    component: "slider",
    label: "Angle range (×TAU)",
    min: 0,
    max: 3,
    step: 0.01
  },
  scale: {
    component: "slider",
    label: "Point scale",
    min: 0,
    max: 2,
    step: 0.01
  },

  // Stroke weight mapping
  weightMin: {
    component: "slider",
    label: "Stroke weight min",
    min: 0,
    max: 300,
    step: 1
  },
  weightMax: {
    component: "slider",
    label: "Stroke weight max",
    min: 0,
    max: 300,
    step: 1
  },

  // Color palette + styling
  palette: {
    component: "select",
    label: "Palette",
    options: [
      {
        label: "Rainbow",
        value: "rainbow"
      },
      {
        label: "Purple",
        value: "purple"
      }
    ]
  },
  hueOffset: {
    component: "slider",
    label: "Hue offset",
    min: 0,
    max: 360,
    step: 1
  },
  opacityFactorFrom: {
    component: "slider",
    label: "Opacity factor (from)",
    min: 0,
    max: 3,
    step: 0.01
  },
  opacityFactorTo: {
    component: "slider",
    label: "Opacity factor (to)",
    min: 0,
    max: 3,
    step: 0.01
  },

  // Title text sizing
  textSizeDivisor: {
    component: "slider",
    label: "Title size divisor",
    min: 1,
    max: 16,
    step: 0.01
  }
};
