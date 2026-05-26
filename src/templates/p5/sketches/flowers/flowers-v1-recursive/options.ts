import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

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
    boundary: 150,
    step: 1 / 512
  },
  foreground: {
    palette: "rainbow",
    sidesMin: 2,
    sidesMax: 6,
    borderWidthMin: 20,
    borderWidthMax: 70,
    sizeMaxMin: 150,
    sizeMax: 400,
    recursionDepth: 1,
    rotationSpeed: 1,
    hueIndexMultiplier: 4,
    opacityMax: 5,
    opacityMin: 1
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
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
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      sidesMin: {
        label: "Sides min (mapping in)",
        component: "slider",
        min: 1,
        max: 10,
        step: 1
      },
      sidesMax: {
        label: "Sides max (mapping in)",
        component: "slider",
        min: 2,
        max: 12,
        step: 1
      },
      borderWidthMin: {
        label: "Border width min",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      },
      borderWidthMax: {
        label: "Border width max",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      },
      sizeMaxMin: {
        label: "Size cap (few sides)",
        component: "slider",
        min: 10,
        max: 800,
        step: 1
      },
      sizeMax: {
        label: "Size cap (many sides)",
        component: "slider",
        min: 10,
        max: 1200,
        step: 1
      },
      recursionDepth: {
        label: "Recursion depth",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      rotationSpeed: {
        label: "Rotation speed",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
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
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
