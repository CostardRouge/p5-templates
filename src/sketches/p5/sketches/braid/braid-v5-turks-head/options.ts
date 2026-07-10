
export const formValues = {
  timeScale: 1,
  weave: {
    strands: 3,
    leads: 5,
    wireRadius: 0.09,
    depth: 0.14,
    minorRadius: 0.45,
    ringRadius: 1.7,
    spin: 0
  },
  orientation: {
    x: 0,
    y: 1
  },
  camera: {
    distance: 11.5,
    fov: 50,
    pitch: 0.42,
    yaw: 0,
    orbitSpeed: 1,
    fogDensity: 0.1
  },
  colors: {
    hueSpeed: 0,
    hueSpread: 2,
    huePhase: 2.6,
    lengthHueShift: 0.35,
    pipeHueShift: 0.5,
    shimmer: 2,
    saturation: 0.7,
    brightness: 1.3
  },
  light: {
    azimuth: -1.1,
    elevation: 0.5,
    ambient: 0.3,
    diffuse: 0.85,
    specular: 1.2,
    specPower: 48,
    fresnelPower: 3,
    rimStrength: 0.7,
    shadowSoftness: 22
  },
  aberration: {
    amount: 2,
    mode: "radial" as "radial" | "horizontal"
  },
  rendering: {
    resolutionScale: 0.7
  },
  backgroundColor: [
    0,
    0,
    0
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
  weave: {
    component: "nested-object",
    label: "Turk's head weave",
    fields: {
      strands: {
        label: "Strands per family",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      leads: {
        label: "Leads (poloidal wraps, snaps to whole)",
        component: "slider",
        min: 2,
        max: 20,
        step: 1
      },
      wireRadius: {
        label: "Strand thickness",
        component: "slider",
        min: 0.03,
        max: 0.2,
        step: 0.005
      },
      depth: {
        label: "Weave depth (auto-floored for clearance)",
        component: "slider",
        min: 0.05,
        max: 0.4,
        step: 0.01
      },
      minorRadius: {
        label: "Lay radius (auto-floored for clearance)",
        component: "slider",
        min: 0.2,
        max: 1,
        step: 0.01
      },
      ringRadius: {
        label: "Ring radius",
        component: "slider",
        min: 0.8,
        max: 3,
        step: 0.01
      },
      spin: {
        label: "Weave roll (snaps to whole turns/loop)",
        component: "slider",
        min: -6,
        max: 6,
        step: 0.1
      }
    }
  },
  orientation: {
    component: "vector2d",
    label: "Orientation",
    min: -1,
    max: 1,
    step: 0.01
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      distance: {
        label: "Distance",
        component: "slider",
        min: 2,
        max: 14,
        step: 0.05
      },
      fov: {
        label: "Field of view °",
        component: "slider",
        min: 20,
        max: 90,
        step: 1
      },
      pitch: {
        label: "Pitch (elevation)",
        component: "slider",
        min: -1.2,
        max: 1.2,
        step: 0.01
      },
      yaw: {
        label: "Yaw (base angle)",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      orbitSpeed: {
        label: "Orbit speed (snaps to whole orbits/loop)",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      },
      fogDensity: {
        label: "Fog density",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.005
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Iridescent",
    fields: {
      hueSpeed: {
        label: "Hue speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0.1,
        max: 6,
        step: 0.01
      },
      huePhase: {
        label: "Hue phase",
        component: "slider",
        min: 0,
        max: 6.2832,
        step: 0.01
      },
      lengthHueShift: {
        label: "Length hue shift",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      pipeHueShift: {
        label: "Strand hue shift",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      shimmer: {
        label: "Shimmer (oil-slick)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      saturation: {
        label: "Saturation",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      }
    }
  },
  light: {
    component: "nested-object",
    label: "Lighting",
    fields: {
      azimuth: {
        label: "Light azimuth",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      elevation: {
        label: "Light elevation",
        component: "slider",
        min: -1.5708,
        max: 1.5708,
        step: 0.01
      },
      ambient: {
        label: "Ambient",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      diffuse: {
        label: "Diffuse",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      specular: {
        label: "Specular",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      specPower: {
        label: "Specular sharpness",
        component: "slider",
        min: 1,
        max: 128,
        step: 1
      },
      fresnelPower: {
        label: "Fresnel power",
        component: "slider",
        min: 0.5,
        max: 6,
        step: 0.01
      },
      rimStrength: {
        label: "Rim glow",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      shadowSoftness: {
        label: "Strand shadows (0 = off, higher = harder)",
        component: "slider",
        min: 0,
        max: 64,
        step: 1
      }
    }
  },
  aberration: {
    component: "nested-object",
    label: "Chromatic aberration",
    fields: {
      amount: {
        label: "Amount px (0 = off)",
        component: "slider",
        min: 0,
        max: 40,
        step: 0.5
      },
      mode: {
        label: "Direction",
        component: "select",
        options: [
          {
            label: "Radial",
            value: "radial"
          },
          {
            label: "Horizontal",
            value: "horizontal"
          }
        ]
      }
    }
  },
  rendering: {
    component: "nested-object",
    label: "Rendering",
    fields: {
      resolutionScale: {
        label: "Resolution scale (perf ↔ quality)",
        component: "slider",
        min: 0.25,
        max: 1,
        step: 0.05
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
