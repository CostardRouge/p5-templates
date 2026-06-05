// Default values only
export const formValues = {
  videos: [],

  text: "VIDEO",
  font: "martian",
  textSizeDivisor: 2.3,

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

  text: {
    component: "text",
    label: "Text"
  },

  font: {
    component: "select",
    label: "Font",
    options: [
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
    ]
  },

  textSizeDivisor: {
    component: "slider",
    label: "Text size",
    min: 1,
    max: 6,
    step: 0.1
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
