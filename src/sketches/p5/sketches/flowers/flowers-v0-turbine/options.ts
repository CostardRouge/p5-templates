
const PALETTE_OPTIONS = [
  {
    label: "Rainbow",
    value: "rainbow"
  },
  {
    label: "Rainbow crazy",
    value: "rainbowCrazy"
  },
  {
    label: "Purple",
    value: "purple"
  },
  {
    label: "Purple simple",
    value: "purpleSimple"
  },
  {
    label: "Dark blue / yellow",
    value: "darkBlueYellow"
  },
  {
    label: "Green",
    value: "green"
  },
  {
    label: "Black",
    value: "black"
  }
];

export const formValues = {
  timeScale: 1,
  background: {
    enabled: true,
    columns: 30,
    rows: 50,
    palette: "purple",
    opacityFactor: 4.5,
    borderWidth: 2,
    size: 25
  },
  path: {
    boundary: 75,
    step: 1 / 512
  },
  foreground: {
    paletteA: "rainbow",
    paletteB: "purple",
    borderWidth: 75,
    sizeMin: 1,
    sizeMax: 250,
    opacityMax: 3,
    opacityMin: 1,
    hueIndexMultiplier: 4,
    rotationSpeed: 0.2
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ]
};

export const formConfiguration: Record<string, any> = {
  timeScale: {
    label: "Time scale",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.01
  },
  background: {
    component: "nested-object",
    label: "Background grid",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox"
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 80,
        step: 1
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 120,
        step: 1
      },
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      opacityFactor: {
        label: "Opacity factor",
        component: "slider",
        min: 1,
        max: 15,
        step: 0.1
      },
      borderWidth: {
        label: "Border width",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.5
      },
      size: {
        label: "Cross size",
        component: "slider",
        min: 1,
        max: 80,
        step: 1
      }
    }
  },
  path: {
    component: "nested-object",
    label: "Path",
    fields: {
      boundary: {
        label: "Boundary (top/bottom px)",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      step: {
        label: "Step (smaller = denser)",
        component: "slider",
        min: 0.0005,
        max: 0.05,
        step: 0.0005
      }
    }
  },
  foreground: {
    component: "nested-object",
    label: "Foreground crosses",
    fields: {
      paletteA: {
        label: "Palette A",
        component: "select",
        options: PALETTE_OPTIONS
      },
      paletteB: {
        label: "Palette B",
        component: "select",
        options: PALETTE_OPTIONS
      },
      borderWidth: {
        label: "Border width",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      },
      sizeMin: {
        label: "Size min",
        component: "slider",
        min: 0,
        max: 500,
        step: 1
      },
      sizeMax: {
        label: "Size max",
        component: "slider",
        min: 1,
        max: 1000,
        step: 1
      },
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      opacityMin: {
        label: "Opacity min",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      hueIndexMultiplier: {
        label: "Hue index multiplier",
        component: "slider",
        min: 0,
        max: 16,
        step: 0.1
      },
      rotationSpeed: {
        label: "Rotation speed",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
