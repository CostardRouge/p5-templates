// Default values only
export const formValues = {
  videos: [],

  text: "VIDEO",
  font: "martian",
  fontSize: 60,
  align: "center",
  lineHeight: 1,
  margin: 0,
  style: "fill",
  outlineWeight: 8,
  invert: false,

  backgroundColor: [
    10,
    10,
    12
  ]
};

const fontOptions = [
  {
    label: "Martian",
    value: "martian"
  },
  {
    label: "Sans (Passion One)",
    value: "sans"
  },
  {
    label: "Serif (Baskerville)",
    value: "serif"
  },
  {
    label: "Open Sans",
    value: "openSans"
  },
  {
    label: "Space Mono",
    value: "spaceMonoRegular"
  },
  {
    label: "Lora",
    value: "loraRegular"
  },
  {
    label: "Tilt Prism",
    value: "tilt"
  },
  {
    label: "Stardom",
    value: "stardom"
  },
  {
    label: "Cloitre",
    value: "cloitre"
  },
  {
    label: "Agiro",
    value: "agiro"
  },
  {
    label: "Peix",
    value: "peix"
  }
];

// UI configuration only
export const formConfiguration: Record<string, any> = {
  videos: {
    component: "asset-stack",
    kind: "videos",
    label: "Videos"
  },

  text: {
    component: "textarea",
    label: "Text"
  },

  font: {
    component: "select",
    label: "Font",
    options: fontOptions
  },

  fontSize: {
    component: "slider",
    label: "Font size (% of height)",
    min: 5,
    max: 150,
    step: 1
  },

  align: {
    component: "select",
    label: "Alignment",
    options: [
      {
        label: "Left",
        value: "left"
      },
      {
        label: "Center",
        value: "center"
      },
      {
        label: "Right",
        value: "right"
      }
    ]
  },

  lineHeight: {
    component: "slider",
    label: "Line height",
    min: 0.7,
    max: 2,
    step: 0.05
  },

  margin: {
    component: "slider",
    label: "Margin (px)",
    min: 0,
    max: 400,
    step: 1
  },

  style: {
    component: "select",
    label: "Style",
    options: [
      {
        label: "Fill",
        value: "fill"
      },
      {
        label: "Outline",
        value: "outline"
      }
    ]
  },

  outlineWeight: {
    component: "slider",
    label: "Outline weight",
    min: 1,
    max: 40,
    step: 1
  },

  invert: {
    component: "checkbox",
    label: "Invert (video around the text)"
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
