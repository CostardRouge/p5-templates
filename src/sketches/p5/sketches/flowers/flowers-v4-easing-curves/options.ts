
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
    columns: 7,
    rows: 12,
    palette: "purple",
    opacityFactor: 3.5,
    borderWidth: 3,
    size: 15
  },
  path: {
    boundary: 250,
    step: 1 / 256,
    anchorSpeed: 0.5,
    anchorLerpAmount: 0.1
  },
  foreground: {
    palette: "rainbow",
    sides: 1,
    times: 1,
    sizeMin: 1,
    sizeMax: 250,
    borderWidth: 70,
    hueIndexMultiplier: 4,
    opacityMax: 5,
    opacityMin: 1
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
        max: 60,
        step: 1
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 100,
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
    label: "Path (2 anchors)",
    fields: {
      boundary: {
        label: "Boundary px",
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
      },
      anchorSpeed: {
        label: "Anchor switch speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      anchorLerpAmount: {
        label: "Anchor lerp smoothing",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01
      }
    }
  },
  foreground: {
    component: "nested-object",
    label: "Foreground curves",
    fields: {
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      sides: {
        label: "Sides",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      times: {
        label: "Oscillation cycles",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      sizeMin: {
        label: "Size min",
        component: "slider",
        min: 0,
        max: 100,
        step: 1
      },
      sizeMax: {
        label: "Size max",
        component: "slider",
        min: 10,
        max: 800,
        step: 1
      },
      borderWidth: {
        label: "Border width",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      },
      hueIndexMultiplier: {
        label: "Hue index multiplier",
        component: "slider",
        min: 0,
        max: 16,
        step: 0.1
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
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
