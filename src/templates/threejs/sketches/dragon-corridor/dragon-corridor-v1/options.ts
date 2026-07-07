
export const formValues = {
  timeScale: 1,
  motion: {
    direction: "backward" as "backward" | "forward",
    swimX: 0.25,
    swimY: 0.19,
    swimWaves: 4,
    swimSpeed: -2.3,
    swimPhase: 1.7
  },
  dragon: {
    pipeCount: 4,
    pipeRadius: 0.07,
    braidRadius: 0.13,
    twist: 0.14,
    spin: 0,
    radiusPulse: 0.35,
    pulseWaves: 3,
    pulseTravel: -0.45,
    tailThin: 0.9,
    headGap: 1.3,
    headMerge: 1.25,
    headRound: 0.4
  },
  dodge: {
    hesitation: 0,
    sharpness: 2.1,
    bunch: 0.32
  },
  obstacles: {
    segmentsPerLoop: 9,
    seed: 128,
    weave: 0.29,
    glassAlpha: 0.32,
    thickness: 0.12,
    edgeSoftness: 0.03,
    frost: 0.5,
    frostScale: 9,
    milk: 0.3,
    glassTint: 0.3,
    edgeGlow: 0.8,
    glassColor: [
      140,
      200,
      242
    ]
  },
  corridor: {
    wallColor: [
      23,
      26,
      41
    ],
    wallGlow: 1.82,
    ribs: 3,
    fogDensity: 0.135
  },
  camera: {
    x: 0,
    y: 0.12,
    z: 2.5,
    pitch: -0.05,
    yaw: 0,
    fov: 90,
    fpvFollow: 0,
    fpvAim: 0,
    fpvBank: 0,
    fpvSmooth: 0.5,
    quality: 0.85
  },
  colors: {
    hueSpeed: 1,
    hueSpread: 1.6,
    huePhase: 0.4,
    lengthHueShift: 0.22,
    pipeHueShift: 0.33,
    shimmer: 0.9,
    saturation: 0.9,
    brightness: 1.1
  },
  light: {
    azimuth: -0.6,
    elevation: 0.7,
    ambient: 0.22,
    diffuse: 0.8,
    specular: 0.5,
    specPower: 32,
    fresnelPower: 2.8,
    rimStrength: 0.45
  },
  backgroundColor: [
    4,
    4,
    10
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
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      direction: {
        label: "Corridor direction",
        component: "select",
        options: [
          {
            label: "Flying in (scene recedes)",
            value: "backward"
          },
          {
            label: "Rushing past (scene approaches)",
            value: "forward"
          }
        ]
      },
      swimX: {
        label: "Swim sway X",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      swimY: {
        label: "Swim sway Y",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      swimWaves: {
        label: "Swim waves / loop",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      swimSpeed: {
        label: "Swim speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01
      },
      swimPhase: {
        label: "Swim axis phase (π/2 ≈ circling)",
        component: "slider",
        min: 0,
        max: 6.2832,
        step: 0.01
      }
    }
  },
  dragon: {
    component: "nested-object",
    label: "Dragon (pipe braid)",
    fields: {
      pipeCount: {
        label: "Pipes",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      pipeRadius: {
        label: "Pipe radius",
        component: "slider",
        min: 0.03,
        max: 0.4,
        step: 0.01
      },
      braidRadius: {
        label: "Braid radius",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      twist: {
        label: "Twist (winding)",
        component: "slider",
        min: 0,
        max: 6,
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
        label: "Body pulse (morph)",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      pulseWaves: {
        label: "Pulse waves / loop",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      pulseTravel: {
        label: "Pulse travel (snaps to whole cycles/loop)",
        component: "slider",
        min: -6,
        max: 6,
        step: 0.01
      },
      tailThin: {
        label: "Tail thinning",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      headGap: {
        label: "Head distance",
        component: "slider",
        min: 0.4,
        max: 4,
        step: 0.05
      },
      headMerge: {
        label: "Head merge (braid → head)",
        component: "slider",
        min: 0.1,
        max: 2.5,
        step: 0.05
      },
      headRound: {
        label: "Head roundness",
        component: "slider",
        min: 0.02,
        max: 0.4,
        step: 0.01
      }
    }
  },
  dodge: {
    component: "nested-object",
    label: "Dodge behaviour",
    fields: {
      hesitation: {
        label: "Hesitation (hold before dodging)",
        component: "slider",
        min: 0,
        max: 0.85,
        step: 0.01
      },
      sharpness: {
        label: "Commit sharpness",
        component: "slider",
        min: 0.5,
        max: 4,
        step: 0.05
      },
      bunch: {
        label: "Body bunch around the corner",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      }
    }
  },
  obstacles: {
    component: "nested-object",
    label: "Obstacles (glass walls)",
    fields: {
      segmentsPerLoop: {
        label: "Walls per loop (speed)",
        component: "slider",
        min: 2,
        max: 16,
        step: 1
      },
      seed: {
        label: "Obstacle pattern seed",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      weave: {
        label: "Dodge amount",
        component: "slider",
        min: 0,
        max: 0.7,
        step: 0.01
      },
      glassAlpha: {
        label: "Glass opacity",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      thickness: {
        label: "Glass thickness",
        component: "slider",
        min: 0.02,
        max: 1.2,
        step: 0.01
      },
      edgeSoftness: {
        label: "Edge softness (small = sharp)",
        component: "slider",
        min: 0.002,
        max: 0.35,
        step: 0.002
      },
      frost: {
        label: "Frost mottling",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      frostScale: {
        label: "Frost grain scale",
        component: "slider",
        min: 1,
        max: 30,
        step: 0.5
      },
      milk: {
        label: "Milkiness (white scatter)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      glassTint: {
        label: "Glass iridescence",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      edgeGlow: {
        label: "Edge glow",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      glassColor: {
        label: "Glass color",
        component: "color"
      }
    }
  },
  corridor: {
    component: "nested-object",
    label: "Corridor",
    fields: {
      wallColor: {
        label: "Wall color",
        component: "color"
      },
      wallGlow: {
        label: "Marker glow",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      ribs: {
        label: "Wall ribs / segment (0 = plain)",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      fogDensity: {
        label: "Fog density",
        component: "slider",
        min: 0,
        max: 0.4,
        step: 0.005
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      x: {
        label: "Position X",
        component: "slider",
        min: -0.8,
        max: 0.8,
        step: 0.01
      },
      y: {
        label: "Position Y",
        component: "slider",
        min: -0.8,
        max: 0.8,
        step: 0.01
      },
      z: {
        label: "Position Z",
        component: "slider",
        min: -1,
        max: 4,
        step: 0.01
      },
      pitch: {
        label: "Pitch",
        component: "slider",
        min: -0.6,
        max: 0.6,
        step: 0.01
      },
      yaw: {
        label: "Yaw",
        component: "slider",
        min: -0.6,
        max: 0.6,
        step: 0.01
      },
      fov: {
        label: "Field of view °",
        component: "slider",
        min: 30,
        max: 100,
        step: 1
      },
      fpvFollow: {
        label: "FPV follow (ride the path)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      fpvAim: {
        label: "FPV aim at head",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      fpvBank: {
        label: "FPV banking roll",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      fpvSmooth: {
        label: "FPV smoothing (lazy chase)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      quality: {
        label: "Render quality",
        component: "slider",
        min: 0.4,
        max: 1,
        step: 0.05
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Iridescent (dragon)",
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
        label: "Length hue shift (snaps for seamless loop)",
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
