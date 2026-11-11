// A field of dunes under a low sun: the dunes, the wind that is seen crossing
// them, the sun and sky, the sand itself and the camera. The wind blows along
// +x; angles are in degrees and colours are screen colours, which index.js
// converts.
export const formValues = {
  dunes: {
    length: 7,
    height: 1.25,
    brink: 0.72,
    sinuosity: 1.6,
    sinuosityScale: 0.22,
    irregularity: 2.2,
    variation: 0.45,
    smallDunes: 0.6,
    rolling: 0.8
  },
  wind: {
    veils: 1.3,
    veilLength: 2.4,
    veilWidth: 0.3,
    veilSharpness: 2.4,
    speed: 3,
    gusts: 1,
    plume: 1.2,
    plumeLength: 0.22,
    ripples: 0.26,
    rippleLength: 0.08,
    rippleSpeed: 3
  },
  sun: {
    elevation: 15,
    azimuth: 148,
    size: 1.2,
    power: 40,
    shadowSoftness: 10,
    color: [
      255,
      214,
      170
    ]
  },
  sky: {
    zenith: [
      40,
      110,
      225
    ],
    horizon: [
      226,
      214,
      200
    ],
    light: 1
  },
  sand: {
    color: [
      222,
      130,
      64
    ],
    dust: [
      244,
      190,
      130
    ],
    grain: 0.1,
    haze: 0.01,
    exposure: 1
  },
  camera: {
    height: 1.8,
    along: 3.4,
    across: 0,
    heading: 96,
    pitch: -9,
    fieldOfView: 52,
    sway: 0.6,
    swayCycles: 1,
    far: 120
  },
  quality: {
    renderScale: 0.75,
    steps: 110,
    shadowSteps: 36
  }
};

export const formConfiguration: Record<string, any> = {
  dunes: {
    component: "nested-object",
    label: "Dunes",
    fields: {
      length: {
        label: "Spacing (crest to crest, along the wind)",
        component: "slider",
        min: 2,
        max: 20,
        step: 0.1
      },
      height: {
        label: "Height",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.01
      },
      brink: {
        label: "Brink (where the crest sits: higher = longer climb, steeper face)",
        component: "slider",
        min: 0.5,
        max: 0.88,
        step: 0.01
      },
      sinuosity: {
        label: "Sinuosity (how far the crest lines swing)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      },
      sinuosityScale: {
        label: "Sinuosity rhythm",
        component: "slider",
        min: 0.05,
        max: 1.5,
        step: 0.01
      },
      irregularity: {
        label: "Irregularity (crests that lean, merge and split)",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.01
      },
      variation: {
        label: "Variation (ridge-to-ridge height)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      smallDunes: {
        label: "Small dunes on the slopes",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      rolling: {
        label: "Rolling ground",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      }
    }
  },
  wind: {
    component: "nested-object",
    label: "Wind",
    fields: {
      veils: {
        label: "Veils of sand over the slopes",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      veilLength: {
        label: "Veil length (along the wind)",
        component: "slider",
        min: 0.2,
        max: 8,
        step: 0.05
      },
      veilWidth: {
        label: "Veil width (across the wind)",
        component: "slider",
        min: 0.05,
        max: 3,
        step: 0.01
      },
      veilSharpness: {
        label: "Veil sharpness (thinner threads)",
        component: "slider",
        min: 0.5,
        max: 12,
        step: 0.1
      },
      speed: {
        label: "Wind speed (whole noise periods per loop)",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      gusts: {
        label: "Gusts (extra periods for the fine layer)",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      plume: {
        label: "Plumes off the crests",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      plumeLength: {
        label: "Plume length (down the slip face)",
        component: "slider",
        min: 0.02,
        max: 1,
        step: 0.01
      },
      ripples: {
        label: "Ripples",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      rippleLength: {
        label: "Ripple spacing",
        component: "slider",
        min: 0.03,
        max: 1,
        step: 0.005
      },
      rippleSpeed: {
        label: "Ripple creep (wavelengths per loop)",
        component: "slider",
        min: 0,
        max: 12,
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
        min: 2,
        max: 80,
        step: 0.5
      },
      azimuth: {
        label: "Azimuth (\u00b0, from the wind's direction)",
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
        label: "Disc power",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      shadowSoftness: {
        label: "Shadow softness (lower = softer edge)",
        component: "slider",
        min: 1,
        max: 40,
        step: 0.5
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
      light: {
        label: "Sky light (what the shade gets)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      }
    }
  },
  sand: {
    component: "nested-object",
    label: "Sand",
    fields: {
      color: {
        label: "Sand colour",
        component: "color"
      },
      dust: {
        label: "Blown sand colour",
        component: "color"
      },
      grain: {
        label: "Grain",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      haze: {
        label: "Haze (how soon the dunes dissolve into the air)",
        component: "slider",
        min: 0,
        max: 0.08,
        step: 0.001
      },
      exposure: {
        label: "Exposure",
        component: "slider",
        min: 0.2,
        max: 4,
        step: 0.05
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      height: {
        label: "Eye height above the sand",
        component: "slider",
        min: 0.2,
        max: 8,
        step: 0.05
      },
      along: {
        label: "Place, along the wind",
        component: "slider",
        min: -20,
        max: 20,
        step: 0.1
      },
      across: {
        label: "Place, across the wind",
        component: "slider",
        min: -40,
        max: 40,
        step: 0.1
      },
      heading: {
        label: "Heading (\u00b0; 0 looks downwind, 180 into the wind)",
        component: "slider",
        min: -180,
        max: 180,
        step: 1
      },
      pitch: {
        label: "Pitch (\u00b0)",
        component: "slider",
        min: -40,
        max: 20,
        step: 0.5
      },
      fieldOfView: {
        label: "Field of view (\u00b0, vertical)",
        component: "slider",
        min: 20,
        max: 100,
        step: 1
      },
      sway: {
        label: "Sway (\u00b0)",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.1
      },
      swayCycles: {
        label: "Sways per loop",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      far: {
        label: "View distance",
        component: "slider",
        min: 20,
        max: 200,
        step: 1
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
        min: 32,
        max: 160,
        step: 1
      },
      shadowSteps: {
        label: "Shadow steps",
        component: "slider",
        min: 8,
        max: 64,
        step: 1
      }
    }
  }
};
