import {
  materialFormValues,
  materialFormConfiguration,
  backgroundFormValues,
  backgroundFormConfiguration
} from "../_form.js";

const material = materialFormConfiguration();
const {
  // A flame's heat runs first stop → last stop; there is nothing to mirror.
  fold: _fold,
  ...rampFields
} = material.fields.ramp.fields;

// A flame has no surface, so of the category's material it keeps the ramp
// alone, read by temperature. The custom look is a black-body ramp (black →
// ember red → orange → yellow → white) on a near-black ground; a palette
// replaces both, as everywhere in the category.
export const formValues = {
  flame: {
    size: 0.78,
    baseY: -0.42,
    width: 0.17,
    belly: 0.35,
    taper: 1.15,
    base: 0.45,
    lean: 0
  },
  turbulence: {
    amount: 0.5,
    rise: 2.8,
    frequency: 6,
    stretch: 0.45,
    detail: 5,
    gain: 0.55,
    speed: 5,
    shear: 1
  },
  motion: {
    twist: 2.5,
    spinTurns: 1,
    mirror: false,
    sway: 0.03,
    swayCycles: 2,
    swayWave: 3,
    flicker: 0.25
  },
  heat: {
    intensity: 12.5,
    exposure: 1.4,
    contrast: 1,
    core: 0.7,
    softness: 0.06,
    cooling: 0.4,
    front: 0.5,
    frontWidth: 0.07,
    burn: 0.8,
    blue: 0.5,
    blueColor: [
      40,
      90,
      255
    ],
    glow: 0.06,
    glowSize: 0.5,
    opacity: 0
  },
  sparks: {
    count: 24,
    size: 0.005,
    rise: 1.7,
    spread: 0.7,
    drift: 0.12,
    brightness: 2.5,
    speed: 1
  },
  material: {
    ramp: {
      ...materialFormValues.ramp,
      palette: "custom",
      stops: [
        [
          0,
          0,
          0
        ],
        [
          140,
          14,
          0
        ],
        [
          236,
          70,
          6
        ],
        [
          255,
          128,
          16
        ],
        [
          255,
          176,
          40
        ],
        [
          255,
          222,
          110
        ]
      ],
      hardness: 0,
      bands: 0.76,
      offset: 0.2,
      cyclesPerLoop: 0
    }
  },
  background: {
    ...backgroundFormValues,
    top: [
      5,
      4,
      7
    ],
    bottom: [
      16,
      8,
      6
    ]
  },
  quality: {
    renderScale: 0.75,
    steps: 56
  }
};

export const formConfiguration: Record<string, any> = {
  flame: {
    component: "nested-object",
    label: "Flame shape",
    fields: {
      size: {
        label: "Height (\u00d7 the canvas height)",
        component: "slider",
        min: 0.1,
        max: 1.2,
        step: 0.01
      },
      baseY: {
        label: "Foot position (canvas heights from the centre, up is +)",
        component: "slider",
        min: -0.6,
        max: 0.4,
        step: 0.01
      },
      width: {
        label: "Width (radius, \u00d7 the flame's height)",
        component: "slider",
        min: 0.04,
        max: 0.6,
        step: 0.005
      },
      belly: {
        label: "Belly (how fast it widens from the foot)",
        component: "slider",
        min: 0.05,
        max: 2,
        step: 0.01
      },
      taper: {
        label: "Taper (how long the tip draws out)",
        component: "slider",
        min: 0.2,
        max: 3,
        step: 0.01
      },
      base: {
        label: "Foot width (0 = a teardrop, 1 = a wide bed)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      lean: {
        label: "Lean (the tip's sideways offset)",
        component: "slider",
        min: -0.5,
        max: 0.5,
        step: 0.01
      }
    }
  },
  turbulence: {
    component: "nested-object",
    label: "Turbulence (what eats the edge)",
    fields: {
      amount: {
        label: "Amount",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      rise: {
        label: "Growth towards the tip",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.05
      },
      frequency: {
        label: "Grain (cells per flame height)",
        component: "slider",
        min: 1,
        max: 16,
        step: 0.1
      },
      stretch: {
        label: "Vertical stretch (lower = longer tongues)",
        component: "slider",
        min: 0.15,
        max: 1.5,
        step: 0.01
      },
      detail: {
        label: "Detail (octaves)",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      },
      gain: {
        label: "Roughness",
        component: "slider",
        min: 0.2,
        max: 0.8,
        step: 0.01
      },
      speed: {
        label: "Rise (whole noise periods per loop)",
        component: "slider",
        min: 1,
        max: 16,
        step: 1
      },
      shear: {
        label: "Shear (extra periods per octave, breaks the rigid scroll)",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      twist: {
        label: "Twist (radians of whirl per flame height)",
        component: "slider",
        min: -12,
        max: 12,
        step: 0.1
      },
      spinTurns: {
        label: "Whole turns per loop",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      },
      mirror: {
        label: "Mirror (a symmetric flame)",
        component: "checkbox"
      },
      sway: {
        label: "Sway",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      },
      swayCycles: {
        label: "Sways per loop",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      swayWave: {
        label: "Sway wave along the height",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.1
      },
      flicker: {
        label: "Flicker (light and height)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  heat: {
    component: "nested-object",
    label: "Heat and light",
    fields: {
      intensity: {
        label: "Intensity",
        component: "slider",
        min: 0,
        max: 40,
        step: 0.1
      },
      exposure: {
        label: "Exposure (burns the core to white)",
        component: "slider",
        min: 0.1,
        max: 6,
        step: 0.05
      },
      contrast: {
        label: "Heat contrast (dims the cool edge)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.05
      },
      core: {
        label: "Core depth (how far in the hottest gas sits)",
        component: "slider",
        min: 0.02,
        max: 1.5,
        step: 0.01
      },
      softness: {
        label: "Edge softness",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01
      },
      cooling: {
        label: "Cooling towards the tip",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      front: {
        label: "Flame front (the bright filaments at the edge)",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.05
      },
      frontWidth: {
        label: "Front thickness",
        component: "slider",
        min: 0.01,
        max: 0.5,
        step: 0.005
      },
      burn: {
        label: "Burn to white (near clipping)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      blue: {
        label: "Blue foot",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.05
      },
      blueColor: {
        label: "Blue foot colour",
        component: "color"
      },
      glow: {
        label: "Halo",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      glowSize: {
        label: "Halo size",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.01
      },
      opacity: {
        label: "Body opacity (0 = pure light, 1 = hides the ground)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  sparks: {
    component: "nested-object",
    label: "Sparks",
    fields: {
      count: {
        label: "Count",
        component: "slider",
        min: 0,
        max: 64,
        step: 1
      },
      size: {
        label: "Size",
        component: "slider",
        min: 0.002,
        max: 0.05,
        step: 0.001
      },
      rise: {
        label: "Rise (flame heights)",
        component: "slider",
        min: 0.5,
        max: 3,
        step: 0.05
      },
      spread: {
        label: "Spread",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      drift: {
        label: "Drift",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.05
      },
      speed: {
        label: "Trips per loop",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      }
    }
  },
  material: {
    component: "nested-object",
    label: "Colour (the ramp, read by temperature)",
    fields: {
      ramp: {
        ...material.fields.ramp,
        fields: {
          ...rampFields,
          bands: {
            ...rampFields.bands,
            label: "Ramp cycles from the cold edge to the core"
          },
          offset: {
            ...rampFields.offset,
            label: "Ramp offset (which stop the cold edge reads)"
          }
        }
      }
    }
  },
  background: backgroundFormConfiguration,
  quality: {
    component: "nested-object",
    label: "Quality",
    fields: {
      renderScale: {
        label: "Render scale (lower = faster, a flame is soft anyway)",
        component: "slider",
        min: 0.3,
        max: 1,
        step: 0.05
      },
      steps: {
        label: "Depth slices (quality ↔ speed)",
        component: "slider",
        min: 8,
        max: 96,
        step: 1
      }
    }
  }
};
