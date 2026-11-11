// A shallow pool from straight above: the ripples, the light they gather on
// the floor, the pool itself (its water and its tiles) and the frame. Angles
// are in degrees and colours are screen colours; index.js converts both.
export const formValues = {
  ripples: {
    scale: 1.5,
    detail: 20,
    growth: 1.16,
    gain: 0.72,
    speed: 3,
    seed: 7
  },
  light: {
    focus: 1.25,
    softness: 0.05,
    contrast: 1.4,
    dispersion: 0.12,
    sunlight: 0.8,
    ambient: 0.34,
    glints: 1,
    glintSharpness: 9000,
    steepness: 0.35,
    sunTilt: 50,
    sunDirection: 40
  },
  pool: {
    refraction: 0.02,
    tint: [
      120,
      225,
      235
    ],
    tintAmount: 0.55,
    tileSize: 0.085,
    grout: 0.004,
    tileColor: [
      88,
      196,
      226
    ],
    accentColor: [
      38,
      120,
      196
    ],
    accentShare: 0.14,
    groutColor: [
      214,
      240,
      246
    ],
    variation: 0.12
  },
  frame: {
    zoom: 1,
    rotation: 12,
    sway: 2,
    breath: 0.02,
    driftCycles: 1,
    vignette: 0.5,
    exposure: 1.2
  },
  quality: {
    renderScale: 1
  }
};

export const formConfiguration: Record<string, any> = {
  ripples: {
    component: "nested-object",
    label: "Ripples",
    fields: {
      scale: {
        label: "Scale (the longest ripples across the canvas height)",
        component: "slider",
        min: 0.3,
        max: 8,
        step: 0.05
      },
      detail: {
        label: "Detail (ripple components)",
        component: "slider",
        min: 2,
        max: 40,
        step: 1
      },
      growth: {
        label: "How much finer each next ripple is",
        component: "slider",
        min: 1.02,
        max: 1.6,
        step: 0.005
      },
      gain: {
        label: "How much lower each next ripple is",
        component: "slider",
        min: 0.4,
        max: 1,
        step: 0.005
      },
      speed: {
        label: "Speed (turns per loop of the longest ripple)",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      seed: {
        label: "Seed (another pool)",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.01
      }
    }
  },
  light: {
    component: "nested-object",
    label: "Light",
    fields: {
      focus: {
        label: "Focus (depth: how hard the ripples gather the light)",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.01
      },
      softness: {
        label: "Softness (blunts the brightest lines)",
        component: "slider",
        min: 0.005,
        max: 1,
        step: 0.005
      },
      contrast: {
        label: "Contrast (thins the net)",
        component: "slider",
        min: 0.3,
        max: 3,
        step: 0.01
      },
      dispersion: {
        label: "Dispersion (colour fringes along the lines)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.005
      },
      sunlight: {
        label: "Sunlight (the net's brightness)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      },
      ambient: {
        label: "Ambient (what the floor gets between the lines)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      glints: {
        label: "Glints (the sun off the surface)",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.01
      },
      glintSharpness: {
        label: "Glint sharpness",
        component: "slider",
        min: 20,
        max: 20000,
        step: 10
      },
      steepness: {
        label: "Surface steepness (for the glints)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      sunTilt: {
        label: "Sun tilt (\u00b0 from straight overhead)",
        component: "slider",
        min: 0,
        max: 60,
        step: 0.5
      },
      sunDirection: {
        label: "Sun direction (\u00b0)",
        component: "slider",
        min: -180,
        max: 180,
        step: 1
      }
    }
  },
  pool: {
    component: "nested-object",
    label: "Pool",
    fields: {
      refraction: {
        label: "Refraction (how far the ripples bend the floor)",
        component: "slider",
        min: 0,
        max: 0.2,
        step: 0.001
      },
      tint: {
        label: "Water colour",
        component: "color"
      },
      tintAmount: {
        label: "Water colour amount",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      tileSize: {
        label: "Tile size (\u00d7 the canvas height)",
        component: "slider",
        min: 0.02,
        max: 1,
        step: 0.005
      },
      grout: {
        label: "Grout width",
        component: "slider",
        min: 0,
        max: 0.03,
        step: 0.0005
      },
      tileColor: {
        label: "Tile colour",
        component: "color"
      },
      accentColor: {
        label: "Accent tile colour",
        component: "color"
      },
      accentShare: {
        label: "Share of accent tiles",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      groutColor: {
        label: "Grout colour",
        component: "color"
      },
      variation: {
        label: "Tile-to-tile variation",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      }
    }
  },
  frame: {
    component: "nested-object",
    label: "Frame",
    fields: {
      zoom: {
        label: "Zoom (higher = from further up)",
        component: "slider",
        min: 0.3,
        max: 4,
        step: 0.01
      },
      rotation: {
        label: "Rotation (\u00b0)",
        component: "slider",
        min: -180,
        max: 180,
        step: 1
      },
      sway: {
        label: "Sway (\u00b0 of slow turn)",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      breath: {
        label: "Breath (slow zoom in and out)",
        component: "slider",
        min: 0,
        max: 0.2,
        step: 0.005
      },
      driftCycles: {
        label: "Sways per loop",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      vignette: {
        label: "Vignette",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
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
      }
    }
  }
};
