// Open water under a low sun: the waves, the camera riding them, the sun and
// the sky the water mirrors, and the water's own body. Angles are in degrees
// and colours are screen colours; index.js converts both.
export const formValues = {
  waves: {
    scale: 1,
    height: 1,
    choppiness: 0.38,
    detail: 32,
    speed: 4,
    speedGrowth: 1.07,
    frequencyGrowth: 1.18,
    wind: 0,
    spread: 180
  },
  camera: {
    height: 1.6,
    pitch: -8,
    fieldOfView: 58,
    sway: 0.8,
    roll: 0.6,
    bob: 0.08,
    swayCycles: 1
  },
  sun: {
    elevation: 8,
    azimuth: 6,
    size: 1,
    power: 45,
    glow: 0.22,
    color: [
      255,
      206,
      150
    ]
  },
  sky: {
    zenith: [
      40,
      84,
      160
    ],
    horizon: [
      252,
      156,
      96
    ],
    curve: 0.7
  },
  water: {
    color: [
      10,
      84,
      120
    ],
    scatter: 1.1,
    reflectance: 0.04,
    haze: 0.008,
    smoothing: 0.8,
    exposure: 1.05
  },
  quality: {
    renderScale: 0.75,
    steps: 64
  }
};

export const formConfiguration: Record<string, any> = {
  waves: {
    component: "nested-object",
    label: "Waves",
    fields: {
      scale: {
        label: "Scale (higher = smaller waves, a wider sea)",
        component: "slider",
        min: 0.2,
        max: 4,
        step: 0.01
      },
      height: {
        label: "Height",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.01
      },
      choppiness: {
        label: "Choppiness (how much the waves bunch on the crests)",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      detail: {
        label: "Detail (wave components)",
        component: "slider",
        min: 4,
        max: 48,
        step: 1
      },
      speed: {
        label: "Speed (cycles per loop of the longest wave)",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      speedGrowth: {
        label: "How much faster each smaller wave runs",
        component: "slider",
        min: 1,
        max: 1.2,
        step: 0.005
      },
      frequencyGrowth: {
        label: "How much smaller each next wave is",
        component: "slider",
        min: 1.05,
        max: 1.5,
        step: 0.005
      },
      wind: {
        label: "Wind direction (\u00b0; 0 blows away from the camera)",
        component: "slider",
        min: -180,
        max: 180,
        step: 1
      },
      spread: {
        label: "Spread (\u00b0 either side of the wind; 180 = every direction)",
        component: "slider",
        min: 0,
        max: 180,
        step: 1
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      height: {
        label: "Height above the crests",
        component: "slider",
        min: 0.1,
        max: 12,
        step: 0.05
      },
      pitch: {
        label: "Pitch (\u00b0; negative looks down, lifting the horizon)",
        component: "slider",
        min: -60,
        max: 20,
        step: 0.5
      },
      fieldOfView: {
        label: "Field of view (\u00b0, vertical)",
        component: "slider",
        min: 20,
        max: 110,
        step: 1
      },
      sway: {
        label: "Sway (\u00b0 of drift, as on a boat)",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      roll: {
        label: "Roll (\u00b0)",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      bob: {
        label: "Bob (rise and fall)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      swayCycles: {
        label: "Sways per loop",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      }
    }
  },
  sun: {
    component: "nested-object",
    label: "Sun",
    fields: {
      elevation: {
        label: "Elevation (\u00b0 above the horizon)",
        component: "slider",
        min: -5,
        max: 80,
        step: 0.5
      },
      azimuth: {
        label: "Azimuth (\u00b0; 0 is straight ahead)",
        component: "slider",
        min: -180,
        max: 180,
        step: 1
      },
      size: {
        label: "Size (\u00b0)",
        component: "slider",
        min: 0.3,
        max: 10,
        step: 0.1
      },
      power: {
        label: "Power (the disc, and its glitter on the water)",
        component: "slider",
        min: 0,
        max: 400,
        step: 1
      },
      glow: {
        label: "Halo",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      color: {
        label: "Colour",
        component: "color"
      }
    }
  },
  sky: {
    component: "nested-object",
    label: "Sky",
    fields: {
      zenith: {
        label: "Zenith",
        component: "color"
      },
      horizon: {
        label: "Horizon",
        component: "color"
      },
      curve: {
        label: "Gradient curve (lower keeps the horizon colour low)",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.01
      }
    }
  },
  water: {
    component: "nested-object",
    label: "Water",
    fields: {
      color: {
        label: "Body colour (what shows through, brightest in the crests)",
        component: "color"
      },
      scatter: {
        label: "Body light",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      reflectance: {
        label: "Reflectance seen straight down",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      },
      haze: {
        label: "Haze (how soon the sea dissolves into the horizon)",
        component: "slider",
        min: 0,
        max: 0.2,
        step: 0.001
      },
      smoothing: {
        label: "Distance smoothing (flattens far waves, against shimmer)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      exposure: {
        label: "Exposure",
        component: "slider",
        min: 0.2,
        max: 6,
        step: 0.05
      }
    }
  },
  quality: {
    component: "nested-object",
    label: "Quality",
    fields: {
      renderScale: {
        label: "Render scale (lower = faster)",
        component: "slider",
        min: 0.3,
        max: 1,
        step: 0.05
      },
      steps: {
        label: "March steps",
        component: "slider",
        min: 8,
        max: 96,
        step: 1
      }
    }
  }
};
