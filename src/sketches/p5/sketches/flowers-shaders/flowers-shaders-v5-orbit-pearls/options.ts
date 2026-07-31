
export const formValues = {
  timeScale: 1,
  braid: {
    pipeCount: 4,
    pipeRadius: 0.21,
    braidRadius: 0.56,
    twist: 2.08,
    spin: -0.77,
    radiusPulse: 0.47,
    pulseFreq: 1.38,
    pulseSpeed: 2.12
  },
  pearls: {
    count: 3,
    size: 0.3,
    speed: 1,
    swirl: 1,
    gravity: 0.35,
    orbitRadius: 1.25,
    phase: 0,
    spread: 0.5,
    deform: 0.8,
    deformRadius: 0.8,
    span: 6,
    tint: 0.35,
    brightness: 1.15,
    hueShift: 0.4
  },
  camera: {
    distance: 5.1,
    fov: 58,
    pitch: -0.03,
    yaw: -0.4,
    orbitSpeed: 0.21,
    fogDensity: 0.21
  },
  quality: {
    renderScale: 0.85
  },
  colors: {
    hueSpeed: 1.15,
    hueSpread: 2.03,
    huePhase: 2.63,
    lengthHueShift: -0.36,
    pipeHueShift: -0.96,
    shimmer: 2.82,
    saturation: 0.88,
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
    rimStrength: 0.87
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
    label: "Braid (3D pipes)",
    fields: {
      pipeCount: {
        label: "Pipes",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      pipeRadius: {
        label: "Pipe radius",
        component: "slider",
        min: 0.05,
        max: 0.8,
        step: 0.01
      },
      braidRadius: {
        label: "Braid radius (orbit)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      twist: {
        label: "Twist (winding)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      },
      spin: {
        label: "Spin speed (snaps to whole turns/loop)",
        component: "slider",
        min: -3,
        max: 3,
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
  pearls: {
    component: "nested-object",
    label: "Pearls (outside orbit)",
    fields: {
      count: {
        label: "Pearls (0 = plain tornado)",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      size: {
        label: "Pearl size",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      speed: {
        label: "Fall speed (snaps to whole falls/loop, negative = upward)",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      },
      swirl: {
        label: "Swirl (turns/fall, 0 = straight drop, negative = reverse)",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      },
      gravity: {
        label: "Gravity (0 = steady, 1 = accelerating)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      orbitRadius: {
        label: "Orbit radius (distance from the axis)",
        component: "slider",
        min: 0.5,
        max: 3,
        step: 0.01
      },
      phase: {
        label: "Phase (rotate the formation, turns)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      spread: {
        label: "Spread (azimuth stagger between pearls, turns)",
        component: "slider",
        min: -1,
        max: 1,
        step: 0.01
      },
      deform: {
        label: "Deformation (negative = attract pipes)",
        component: "slider",
        min: -1.5,
        max: 1.5,
        step: 0.01
      },
      deformRadius: {
        label: "Deformation reach",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.01
      },
      span: {
        label: "Travel span (height)",
        component: "slider",
        min: 2,
        max: 12,
        step: 0.1
      },
      tint: {
        label: "Iridescent tint (0 = white nacre)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      brightness: {
        label: "Pearl brightness",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      hueShift: {
        label: "Pearl hue shift",
        component: "slider",
        min: -2,
        max: 2,
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
        label: "Yaw (base orbit)",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      orbitSpeed: {
        label: "Orbit speed (snaps to whole orbits/loop)",
        component: "slider",
        min: -2,
        max: 2,
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
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
