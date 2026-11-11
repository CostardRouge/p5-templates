// A lake of lava at night: the crust's plates, the heat drifting under them,
// the melt's own light, the crust's rock, the air above and the camera.
// Angles are in degrees and colours are screen colours; index.js converts
// both. Molten metal is the same sketch with a brighter, yellower melt and a
// greyer crust.
export const formValues = {
  plates: {
    size: 1,
    crack: 0.06,
    softness: 0.02,
    fineCracks: 0.07,
    warp: 1.2,
    wander: 0.75,
    breath: 0.3,
    bevel: 1.2,
    flow: 1
  },
  heat: {
    size: 4,
    flow: 2,
    contrast: 1.4,
    plateGlow: 0.35,
    halo: 0.12
  },
  melt: {
    cool: [
      170,
      14,
      0
    ],
    hot: [
      255,
      120,
      14
    ],
    core: [
      255,
      232,
      170
    ],
    glow: 5,
    contrast: 1.6
  },
  crust: {
    color: [
      58,
      46,
      44
    ],
    roughness: 1.4,
    rim: 1.2,
    rimColor: [
      120,
      150,
      210
    ],
    rimDirection: 25,
    rimHeight: 22
  },
  air: {
    haze: [
      70,
      14,
      6
    ],
    hazeDensity: 0.045,
    sky: [
      8,
      6,
      10
    ],
    shimmer: 0.008,
    shimmerSpeed: 3,
    sparks: 22,
    sparkSize: 0.004,
    sparkBrightness: 1.2,
    sparkSpeed: 1
  },
  camera: {
    height: 2.6,
    pitch: -24,
    fieldOfView: 52,
    sway: 0.7,
    swayCycles: 1,
    exposure: 1,
    renderScale: 1
  }
};

export const formConfiguration: Record<string, any> = {
  plates: {
    component: "nested-object",
    label: "Crust plates",
    fields: {
      size: {
        label: "Plate size",
        component: "slider",
        min: 0.2,
        max: 4,
        step: 0.01
      },
      crack: {
        label: "Crack width",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.002
      },
      softness: {
        label: "Crack softness",
        component: "slider",
        min: 0.002,
        max: 0.2,
        step: 0.002
      },
      fineCracks: {
        label: "Fine cracks (where the heat is)",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.002
      },
      warp: {
        label: "Warp (bends the cracks; 0 = straight-edged plates)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      wander: {
        label: "Wander (how much the plates change shape)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      breath: {
        label: "Breath (each plate's own pulse)",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      bevel: {
        label: "Curled edges",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      flow: {
        label: "Flow (whole lattice periods per loop; 0 = a still lake)",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      }
    }
  },
  heat: {
    component: "nested-object",
    label: "Heat under the crust",
    fields: {
      size: {
        label: "Size of the hot regions",
        component: "slider",
        min: 0.5,
        max: 12,
        step: 0.05
      },
      flow: {
        label: "Drift (whole periods per loop)",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      contrast: {
        label: "Contrast (higher = fewer, hotter regions)",
        component: "slider",
        min: 0.3,
        max: 4,
        step: 0.01
      },
      plateGlow: {
        label: "Glow of thinning crust",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      halo: {
        label: "Warmth spilling over a crack's lips",
        component: "slider",
        min: 0.005,
        max: 0.4,
        step: 0.005
      }
    }
  },
  melt: {
    component: "nested-object",
    label: "Melt",
    fields: {
      cool: {
        label: "Coolest glow",
        component: "color"
      },
      hot: {
        label: "Hot",
        component: "color"
      },
      core: {
        label: "Hottest",
        component: "color"
      },
      glow: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      contrast: {
        label: "Contrast (dims the cooler melt)",
        component: "slider",
        min: 0.3,
        max: 4,
        step: 0.01
      }
    }
  },
  crust: {
    component: "nested-object",
    label: "Crust",
    fields: {
      color: {
        label: "Rock colour",
        component: "color"
      },
      roughness: {
        label: "Roughness",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      },
      rim: {
        label: "Night light on the crust",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      rimColor: {
        label: "Night light colour",
        component: "color"
      },
      rimDirection: {
        label: "Night light direction (\u00b0; 0 comes from ahead)",
        component: "slider",
        min: -180,
        max: 180,
        step: 1
      },
      rimHeight: {
        label: "Night light height (\u00b0)",
        component: "slider",
        min: 2,
        max: 80,
        step: 1
      }
    }
  },
  air: {
    component: "nested-object",
    label: "Air",
    fields: {
      haze: {
        label: "Haze (the air lit from below)",
        component: "color"
      },
      hazeDensity: {
        label: "Haze density",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.002
      },
      sky: {
        label: "Sky",
        component: "color"
      },
      shimmer: {
        label: "Heat shimmer",
        component: "slider",
        min: 0,
        max: 0.04,
        step: 0.0005
      },
      shimmerSpeed: {
        label: "Shimmer rise (whole periods per loop)",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      sparks: {
        label: "Sparks",
        component: "slider",
        min: 0,
        max: 64,
        step: 1
      },
      sparkSize: {
        label: "Spark size",
        component: "slider",
        min: 0.001,
        max: 0.03,
        step: 0.0005
      },
      sparkBrightness: {
        label: "Spark brightness",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.05
      },
      sparkSpeed: {
        label: "Spark trips per loop",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      height: {
        label: "Height above the crust",
        component: "slider",
        min: 0.3,
        max: 12,
        step: 0.05
      },
      pitch: {
        label: "Pitch (\u00b0; negative looks down)",
        component: "slider",
        min: -89,
        max: -5,
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
      exposure: {
        label: "Exposure",
        component: "slider",
        min: 0.2,
        max: 4,
        step: 0.05
      },
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
