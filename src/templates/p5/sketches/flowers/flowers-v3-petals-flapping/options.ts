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
    columns: 20,
    rows: 25,
    palette: "purple",
    hueIndexMultiplier: 2,
    opacityFactor: 3.5,
    borderWidth: 3,
    size: 10
  },
  path: {
    boundary: 250,
    step: 1 / 384,
    anchorSpeed: 0.33,
    anchorLerpAmount: 0.1
  },
  foreground: {
    palette: "rainbow",
    sides: 1,
    timesLerpAmount: 0.0001,
    sizeMin: 1,
    sizeMax: 250,
    borderWidth: 70,
    rotationSpeed: 0.5,
    flapAmplitude: 1,
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
        max: 80,
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
      hueIndexMultiplier: {
        label: "Hue index multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
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
        max: 60,
        step: 1
      }
    }
  },
  path: {
    component: "nested-object",
    label: "Path (3 anchors)",
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
    label: "Foreground petals",
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
      timesLerpAmount: {
        label: "Times-seq smoothing",
        component: "slider",
        min: 0.00001,
        max: 1,
        step: 0.00001
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
      rotationSpeed: {
        label: "Rotation speed (snaps to whole turns/loop)",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      },
      flapAmplitude: {
        label: "Flap amplitude (× 2π)",
        component: "slider",
        min: 0,
        max: 3,
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
