
export const formValues = {
  timeScale: 1,
  chainmail: {
    ringRadius: 0.5,
    wireRadius: 0.07,
    tilt: 0.55,
    rowSpacing: 0.55,
    columnGap: 0.02,
    scrollRows: 2
  },
  front: {
    height: -1.6,
    growSpan: 1.5
  },
  orientation: {
    x: 0,
    y: 1
  },
  camera: {
    distance: 7,
    fov: 55,
    pitch: 0.5,
    yaw: 0.3,
    fogDensity: 0.14
  },
  colors: {
    hueSpeed: 0,
    hueSpread: 2,
    huePhase: 2.6,
    lengthHueShift: -0.15,
    pipeHueShift: 0.35,
    shimmer: 1.6,
    saturation: 0.6,
    brightness: 1.25
  },
  light: {
    azimuth: -1.1,
    elevation: 0.5,
    ambient: 0.28,
    diffuse: 0.85,
    specular: 1.3,
    specPower: 56,
    fresnelPower: 3,
    rimStrength: 0.7,
    shadowSoftness: 24
  },
  aberration: {
    amount: 2,
    mode: "radial" as "radial" | "horizontal"
  },
  rendering: {
    resolutionScale: 0.75
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
  chainmail: {
    component: "nested-object",
    label: "Chainmail",
    fields: {
      ringRadius: {
        label: "Ring radius",
        component: "slider",
        min: 0.2,
        max: 1.2,
        step: 0.01
      },
      wireRadius: {
        label: "Wire gauge (capped at 30% of ring)",
        component: "slider",
        min: 0.02,
        max: 0.2,
        step: 0.005
      },
      tilt: {
        label: "Row tilt (auto-raised for clearance)",
        component: "slider",
        min: 0.2,
        max: 1.2,
        step: 0.01
      },
      rowSpacing: {
        label: "Row pitch (× ring radius)",
        component: "slider",
        min: 0.5,
        max: 1.2,
        step: 0.01
      },
      columnGap: {
        label: "Extra column gap",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      scrollRows: {
        label: "Scroll rows (snaps to whole EVEN rows/loop)",
        component: "slider",
        min: -8,
        max: 8,
        step: 0.1
      }
    }
  },
  front: {
    component: "nested-object",
    label: "Assembly front",
    fields: {
      height: {
        label: "Height (early ↔ late)",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.05
      },
      growSpan: {
        label: "Condense span (rows to full gauge)",
        component: "slider",
        min: 0.25,
        max: 6,
        step: 0.05
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
        label: "Yaw (orbit)",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
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
        label: "Ring hue shift",
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
        label: "Ring shadows (0 = off, higher = harder)",
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
