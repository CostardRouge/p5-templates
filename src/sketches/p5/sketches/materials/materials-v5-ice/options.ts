// A block of ice in studio light: the block and how it turns, what it is
// made of, what is trapped inside it, the lights it bends and the backdrop.
// Angles are in degrees and colours are screen colours; index.js converts
// both.
export const formValues = {
  shape: {
    seed: 7,
    facets: 16,
    size: 0.72,
    elongation: 1.35,
    depth: 0.85,
    irregularity: 0.6
  },
  motion: {
    spinTurns: 1,
    turn: 0,
    tilt: 12,
    lean: 8,
    nod: 5,
    nodCycles: 1,
    bob: 0.03
  },
  material: {
    index: 1.31,
    dispersion: 0.012,
    bounces: 4,
    tint: [
      150,
      215,
      240
    ],
    absorption: 0.9,
    waviness: 0.07,
    waveScale: 3.5,
    edges: 0.55,
    edgeWidth: 0.012
  },
  inside: {
    cloud: 2.4,
    cloudSize: 0.55,
    cloudScale: 7,
    cracks: 0.9,
    crackCount: 3,
    crackScale: 3.2
  },
  light: {
    keyPower: 9,
    keyAzimuth: -35,
    keyElevation: 48,
    keySize: 22,
    keyColor: [
      255,
      250,
      240
    ],
    rimPower: 7,
    rimAzimuth: 150,
    rimElevation: 20,
    rimColor: [
      170,
      215,
      255
    ],
    band: 1.2,
    exposure: 1.1
  },
  backdrop: {
    top: [
      44,
      84,
      128
    ],
    bottom: [
      6,
      12,
      26
    ],
    glow: 0.5
  },
  camera: {
    distance: 4.2,
    fieldOfView: 34,
    antialiasing: 4,
    renderScale: 1
  }
};

export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Block",
    fields: {
      seed: {
        label: "Seed (another block)",
        component: "slider",
        min: 0,
        max: 999,
        step: 1
      },
      facets: {
        label: "Facets",
        component: "slider",
        min: 4,
        max: 28,
        step: 1
      },
      size: {
        label: "Size",
        component: "slider",
        min: 0.2,
        max: 2,
        step: 0.01
      },
      elongation: {
        label: "Height (\u00d7 the size)",
        component: "slider",
        min: 0.3,
        max: 3,
        step: 0.01
      },
      depth: {
        label: "Depth (\u00d7 the size)",
        component: "slider",
        min: 0.3,
        max: 2,
        step: 0.01
      },
      irregularity: {
        label: "Irregularity (0 = a cut gem, 1 = a broken chunk)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      spinTurns: {
        label: "Whole turns per loop",
        component: "slider",
        min: -3,
        max: 3,
        step: 1
      },
      turn: {
        label: "Starting turn (\u00b0)",
        component: "slider",
        min: -180,
        max: 180,
        step: 1
      },
      tilt: {
        label: "Tilt towards the camera (\u00b0)",
        component: "slider",
        min: -60,
        max: 60,
        step: 1
      },
      lean: {
        label: "Lean sideways (\u00b0)",
        component: "slider",
        min: -60,
        max: 60,
        step: 1
      },
      nod: {
        label: "Nod (\u00b0 of slow rocking)",
        component: "slider",
        min: 0,
        max: 30,
        step: 0.5
      },
      nodCycles: {
        label: "Nods per loop",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      bob: {
        label: "Bob (rise and fall)",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      }
    }
  },
  material: {
    component: "nested-object",
    label: "Material",
    fields: {
      index: {
        label: "Refractive index (1.31 ice, 1.5 glass, 2.4 diamond)",
        component: "slider",
        min: 1.02,
        max: 2.6,
        step: 0.01
      },
      dispersion: {
        label: "Dispersion (the spectra along the lights)",
        component: "slider",
        min: 0,
        max: 0.08,
        step: 0.001
      },
      bounces: {
        label: "Bounces followed inside",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      },
      tint: {
        label: "Colour taken on with thickness",
        component: "color"
      },
      absorption: {
        label: "Absorption (how fast that colour comes)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      },
      waviness: {
        label: "Surface waviness (melted and refrozen)",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.005
      },
      waveScale: {
        label: "Waviness scale",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.1
      },
      edges: {
        label: "White edges",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      edgeWidth: {
        label: "Edge width",
        component: "slider",
        min: 0.002,
        max: 0.1,
        step: 0.001
      }
    }
  },
  inside: {
    component: "nested-object",
    label: "Inside",
    fields: {
      cloud: {
        label: "Milky heart (trapped air)",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.05
      },
      cloudSize: {
        label: "Heart size (\u00d7 the block)",
        component: "slider",
        min: 0.1,
        max: 1.5,
        step: 0.01
      },
      cloudScale: {
        label: "Heart grain",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.1
      },
      cracks: {
        label: "Fractures (their brightness)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      crackCount: {
        label: "Fracture planes",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      crackScale: {
        label: "Fracture patchiness",
        component: "slider",
        min: 0.5,
        max: 12,
        step: 0.1
      }
    }
  },
  light: {
    component: "nested-object",
    label: "Light",
    fields: {
      keyPower: {
        label: "Key light",
        component: "slider",
        min: 0,
        max: 30,
        step: 0.1
      },
      keyAzimuth: {
        label: "Key light direction (\u00b0; 0 is behind the camera)",
        component: "slider",
        min: -180,
        max: 180,
        step: 1
      },
      keyElevation: {
        label: "Key light height (\u00b0)",
        component: "slider",
        min: -80,
        max: 85,
        step: 1
      },
      keySize: {
        label: "Key light size (\u00b0)",
        component: "slider",
        min: 3,
        max: 60,
        step: 0.5
      },
      keyColor: {
        label: "Key light colour",
        component: "color"
      },
      rimPower: {
        label: "Rim light",
        component: "slider",
        min: 0,
        max: 30,
        step: 0.1
      },
      rimAzimuth: {
        label: "Rim light direction (\u00b0)",
        component: "slider",
        min: -180,
        max: 180,
        step: 1
      },
      rimElevation: {
        label: "Rim light height (\u00b0)",
        component: "slider",
        min: -80,
        max: 85,
        step: 1
      },
      rimColor: {
        label: "Rim light colour",
        component: "color"
      },
      band: {
        label: "Horizon band (a thin line of light all round)",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.05
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
  backdrop: {
    component: "nested-object",
    label: "Backdrop",
    fields: {
      top: {
        label: "Top",
        component: "color"
      },
      bottom: {
        label: "Bottom",
        component: "color"
      },
      glow: {
        label: "Glow behind the block",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      distance: {
        label: "Distance",
        component: "slider",
        min: 1.5,
        max: 10,
        step: 0.05
      },
      fieldOfView: {
        label: "Field of view (\u00b0, vertical)",
        component: "slider",
        min: 15,
        max: 80,
        step: 1
      },
      antialiasing: {
        label: "Antialiasing (rays per pixel)",
        component: "slider",
        min: 1,
        max: 4,
        step: 1
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
