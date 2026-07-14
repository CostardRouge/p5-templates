const PATTERN_OPTIONS = [
  {
    label: "Tunnel (infinite zoom)",
    value: "tunnel"
  },
  {
    label: "Kaleidoscope (mandala)",
    value: "kaleido"
  },
  {
    label: "Moiré (interference)",
    value: "moire"
  }
];

const PALETTE_OPTIONS = [
  {
    label: "Iridescent (oil-slick)",
    value: "iridescent"
  },
  {
    label: "Rainbow",
    value: "rainbow"
  },
  {
    label: "Purple",
    value: "purple"
  },
  {
    label: "Dark blue / yellow",
    value: "darkBlueYellow"
  }
];

// Default values only — exposed at runtime as `options.sketch.*`.
export const formValues = {
  pattern: "tunnel",

  // Geometry. The `…Cycles`, `spin`, `symmetry` and `arms` fields are whole
  // numbers on purpose: integer counts per loop are what keep the animation a
  // perfectly seamless loop (and keep the kaleidoscope's mirror seams closed).
  geometry: {
    symmetry: 6,
    arms: 3,
    bands: 6,
    zoomCycles: 1,
    spin: 1,
    warp: 1.5
  },

  // Colour. `hueCycles` is the number of full spectrum sweeps per loop — the
  // colour cycle is bound to the loop, so it always lands back on its first hue.
  colors: {
    palette: "iridescent",
    hueCycles: 1,
    hueSpread: 1,
    huePhase: 0,
    saturation: 1,
    brightness: 1,
    contrast: 1.3
  },

  scene: {
    backgroundColor: [
      0,
      0,
      0
    ],
    vignette: 0.6,
    breath: 0.08,
    resolutionScale: 1
  }
};

// UI configuration only.
export const formConfiguration: Record<string, any> = {
  pattern: {
    component: "select",
    label: "Pattern",
    options: PATTERN_OPTIONS
  },

  geometry: {
    component: "nested-object",
    label: "Geometry",
    initialExpanded: true,
    fields: {
      symmetry: {
        label: "Kaleidoscope folds",
        component: "slider",
        min: 2,
        max: 24,
        step: 1
      },
      arms: {
        label: "Arms / angular frequency",
        component: "slider",
        min: 0,
        max: 24,
        step: 1
      },
      bands: {
        label: "Rings (radial frequency)",
        component: "slider",
        min: 1,
        max: 40,
        step: 0.5
      },
      zoomCycles: {
        label: "Zoom cycles per loop",
        component: "slider",
        min: 0,
        max: 12,
        step: 1
      },
      spin: {
        label: "Rotations per loop",
        component: "slider",
        min: 0,
        max: 12,
        step: 1
      },
      warp: {
        label: "Warp depth",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.1
      }
    }
  },

  colors: {
    component: "nested-object",
    label: "Colors",
    initialExpanded: true,
    fields: {
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      hueCycles: {
        label: "Colour cycles per loop",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.1
      },
      huePhase: {
        label: "Hue phase",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      saturation: {
        label: "Saturation",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      contrast: {
        label: "Contrast",
        component: "slider",
        min: 0.2,
        max: 4,
        step: 0.05
      }
    }
  },

  scene: {
    component: "nested-object",
    label: "Scene",
    fields: {
      backgroundColor: {
        component: "color",
        label: "Background color"
      },
      vignette: {
        label: "Vignette",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      breath: {
        label: "Brightness breath",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      resolutionScale: {
        label: "Render resolution scale",
        component: "slider",
        min: 0.25,
        max: 1,
        step: 0.05
      }
    }
  }
};
