
export const formValues = {
  timeScale: 3.7,
  rings: {
    count: 22,
    radius: 0.8,
    tube: 0.19,
    tilt: 0.47,
    pulse: 0,
    pulseSpeed: 0,
    pulseStagger: 0,
    seed: 16
  },
  path: {
    spread: 9.2,
    waveAmplitude: 0.85,
    waveCycles: 4,
    wobble: 0.05,
    wobbleCycles: 5
  },
  camera: {
    fov: 110,
    easing: "smoothstep",
    glide: 0.02,
    bank: -0.8,
    fogDensity: 0.27,
    fogStart: 3.65
  },
  colors: {
    hueSpeed: 1,
    hueSpread: 1.35,
    huePhase: 1.9,
    lengthHueShift: -0.25,
    pipeHueShift: 0.6,
    shimmer: 2.56,
    saturation: 0.7,
    brightness: 1.25
  },
  light: {
    azimuth: 1.69,
    elevation: -1.57,
    ambient: 0.25,
    diffuse: 0.8,
    specular: 1.61,
    specPower: 128,
    fresnelPower: 1.68,
    rimStrength: 0,
    shadowSoftness: 64
  },
  aberration: {
    amount: 0,
    mode: "radial" as "radial" | "horizontal"
  },
  rendering: {
    resolutionScale: 0.85
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
  rings: {
    component: "nested-object",
    label: "Rings",
    fields: {
      count: {
        label: "Ring count",
        component: "slider",
        min: 3,
        max: 24,
        step: 1
      },
      radius: {
        label: "Ring radius",
        component: "slider",
        min: 0.4,
        max: 3,
        step: 0.01
      },
      tube: {
        label: "Tube thickness (auto-capped for clearance)",
        component: "slider",
        min: 0.03,
        max: 0.6,
        step: 0.01
      },
      tilt: {
        label: "Tilt jitter (hand-placed feel)",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      pulse: {
        label: "Breathing amount",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      pulseSpeed: {
        label: "Breathing speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      },
      pulseStagger: {
        label: "Breathing stagger (swell travels ring to ring)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      seed: {
        label: "Layout seed",
        component: "slider",
        min: 0,
        max: 60,
        step: 1
      }
    }
  },
  path: {
    component: "nested-object",
    label: "Circuit (spacing)",
    fields: {
      spread: {
        label: "Spacing (tight ↔ far apart)",
        component: "slider",
        min: 2,
        max: 14,
        step: 0.05
      },
      waveAmplitude: {
        label: "Vertical wave amplitude",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      waveCycles: {
        label: "Vertical wave cycles",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      wobble: {
        label: "Radial wobble",
        component: "slider",
        min: 0,
        max: 0.4,
        step: 0.01
      },
      wobbleCycles: {
        label: "Radial wobble cycles",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      fov: {
        label: "Field of view °",
        component: "slider",
        min: 30,
        max: 110,
        step: 1
      },
      easing: {
        label: "Approach easing (per ring segment)",
        component: "easing"
      },
      glide: {
        label: "Glide (0 = constant speed, 1 = dwell at each ring)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      bank: {
        label: "Bank into turns (FPV roll)",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      fogDensity: {
        label: "Fog density",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.005
      },
      fogStart: {
        label: "Fog start distance",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.05
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
        label: "Height hue shift",
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
