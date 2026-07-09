
export const formValues = {
  timeScale: 1,
  braid: {
    strandCount: 3,
    pipeRadius: 0.16,
    braidRadius: 0.6,
    knotType: "plait" as "plait" | "spiral",
    plaitDepth: 0.6,
    roundness: 0.2,
    wind: 3,
    scrollSpeed: 1,
    radiusPulse: 0,
    pulseFreq: 1,
    pulseSpeed: 1
  },
  front: {
    height: -1,
    sharpness: 0.5
  },
  distortion: {
    min: 1,
    max: 1,
    frequency: 0.75,
    travelSpeed: 1,
    easing: "easeInOutSine"
  },
  loose: {
    spread: 1.1,
    stagger: 1,
    sway: 0.12,
    swayFreq: 1.2,
    swaySpeed: 1
  },
  orientation: {
    x: 0,
    y: 1
  },
  camera: {
    distance: 6,
    fov: 55,
    pitch: 0,
    yaw: 0,
    fogDensity: 0.12
  },
  colors: {
    hueSpeed: 1,
    hueSpread: 2,
    huePhase: 2.6,
    lengthHueShift: -0.35,
    pipeHueShift: -0.95,
    shimmer: 2.8,
    saturation: 0.85,
    brightness: 1.3
  },
  light: {
    azimuth: -1.29,
    elevation: -0.6,
    ambient: 0.34,
    diffuse: 0.66,
    specular: 0.99,
    specPower: 24,
    fresnelPower: 3.3,
    rimStrength: 0.87,
    shadowSoftness: 16
  },
  aberration: {
    amount: 3,
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
  braid: {
    component: "nested-object",
    label: "Braid",
    fields: {
      strandCount: {
        label: "Strands",
        component: "slider",
        min: 2,
        max: 12,
        step: 1
      },
      pipeRadius: {
        label: "Pipe radius",
        component: "slider",
        min: 0.05,
        max: 0.6,
        step: 0.01
      },
      braidRadius: {
        label: "Braid radius (amplitude)",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.01
      },
      knotType: {
        label: "Knot type",
        component: "select",
        options: [
          {
            label: "Plait (over-under weave)",
            value: "plait"
          },
          {
            label: "Spiral (helix bundle)",
            value: "spiral"
          }
        ]
      },
      plaitDepth: {
        label: "Plait depth (auto-floored for clearance)",
        component: "slider",
        min: 0.1,
        max: 1,
        step: 0.01
      },
      roundness: {
        label: "Weave roundness (auto-floored for clearance)",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      wind: {
        label: "Winding (crossings per unit)",
        component: "slider",
        min: 0.5,
        max: 8,
        step: 0.01
      },
      scrollSpeed: {
        label: "Scroll speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01
      },
      radiusPulse: {
        label: "Radius pulse",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      pulseFreq: {
        label: "Pulse frequency",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      },
      pulseSpeed: {
        label: "Pulse speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      }
    }
  },
  front: {
    component: "nested-object",
    label: "Braiding front",
    fields: {
      height: {
        label: "Height (early ↔ late)",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.05
      },
      sharpness: {
        label: "Attach zone width (softness)",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.05
      }
    }
  },
  distortion: {
    component: "nested-object",
    label: "Distortion (size curve)",
    fields: {
      min: {
        label: "Min scale (valleys)",
        component: "slider",
        min: 0.2,
        max: 1.5,
        step: 0.01
      },
      max: {
        label: "Max scale (peaks)",
        component: "slider",
        min: 0.5,
        max: 2.5,
        step: 0.01
      },
      frequency: {
        label: "Bumps per unit height",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.05
      },
      travelSpeed: {
        label: "Travel speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01
      },
      easing: {
        label: "Bump easing (expo = sharp bulges)",
        component: "easing"
      }
    }
  },
  loose: {
    component: "nested-object",
    label: "Loose strands",
    fields: {
      spread: {
        label: "Fan spread",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      stagger: {
        label: "Depth stagger (anti-overlap)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      sway: {
        label: "Sway amplitude",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      swayFreq: {
        label: "Sway frequency",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      swaySpeed: {
        label: "Sway speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
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
        max: 12,
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
        label: "Pipe hue shift",
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
