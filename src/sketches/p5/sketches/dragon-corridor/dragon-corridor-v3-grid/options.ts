
export const formValues = {
  timeScale: 1,
  grid: {
    cols: 4,
    rows: 4,
    divesPerLoop: 12,
    seed: 7,
    holeRadius: 0.34
  },
  dragon: {
    bodyLength: 4,
    bodyRadius: 0.14,
    headBulge: 0.35,
    headLength: 0.6,
    tailLength: 1.6,
    radiusPulse: 0.18,
    pulseWaves: 5,
    pulseTravel: -4,
    stripes: 5,
    stripeDepth: 0.35,
    twist: 3,
    spin: -2
  },
  motion: {
    apexHeight: 0.85,
    diveDepth: 0.75,
    arcJitter: 0.5,
    hesitation: 0.55,
    flow: 0.35,
    swimX: 0.05,
    swimZ: 0.05,
    swimWaves: 3,
    swimSpeed: 2,
    swimPhase: 1.6,
    swimDip: 0.85
  },
  plate: {
    color: [
      150,
      190,
      235
    ],
    alpha: 0.55,
    thickness: 0.1,
    edgeSoftness: 0.02,
    frost: 0.45,
    frostScale: 7,
    milk: 0.5,
    tint: 0.12,
    holeGlow: 0.9,
    borderGlow: 0.6,
    targetGlow: 1.2,
    shadow: 0.55,
    shadowSoft: 0.35,
    depthDim: 0.55
  },
  camera: {
    view: "orbit" as "orbit" | "top" | "follow" | "pov",
    distance: 1.45,
    elevation: 0.72,
    orbitTurns: 0,
    orbitPhase: 0.6,
    trackHead: 0,
    followDistance: 2.2,
    followHeight: 0.8,
    aimAhead: 0.5,
    smoothing: 0.5,
    bank: 0.6,
    povLift: 0.12,
    fov: 55,
    quality: 0.8
  },
  colors: {
    hueSpeed: 1,
    hueSpread: 1.55,
    huePhase: 1.17,
    bodyHueWaves: 1.5,
    stripeHueShift: 0.35,
    shimmer: 1.1,
    saturation: 0.9,
    brightness: 1.05
  },
  light: {
    azimuth: -0.9,
    elevation: 0.85,
    ambient: 0.3,
    diffuse: 1,
    specular: 0.6,
    specPower: 24,
    fresnelPower: 2.5,
    rimStrength: 0.5
  },
  sound: {
    splashEnabled: false,
    splashVolume: 0.6,
    splashPitch: 1,
    splashLength: 0.5,
    splashPan: 0.7,
    humEnabled: false,
    humVolume: 0.45,
    humPitch: 1
  },
  fogDensity: 0.05,
  backgroundColor: [
    6,
    8,
    16
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
  grid: {
    component: "nested-object",
    label: "Hole grid",
    fields: {
      cols: {
        label: "Columns",
        component: "slider",
        min: 2,
        max: 6,
        step: 1
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 2,
        max: 6,
        step: 1
      },
      divesPerLoop: {
        label: "Dives per loop (speed, snaps even ≤ holes)",
        component: "slider",
        min: 2,
        max: 24,
        step: 2
      },
      seed: {
        label: "Hole choice seed",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      holeRadius: {
        label: "Hole radius",
        component: "slider",
        min: 0.15,
        max: 0.48,
        step: 0.01
      }
    }
  },
  dragon: {
    component: "nested-object",
    label: "Dragon (finite snake)",
    fields: {
      bodyLength: {
        label: "Body length (in dives)",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.5
      },
      bodyRadius: {
        label: "Body radius (auto-fits the holes)",
        component: "slider",
        min: 0.04,
        max: 0.3,
        step: 0.01
      },
      headBulge: {
        label: "Head swell",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      headLength: {
        label: "Head length",
        component: "slider",
        min: 0.1,
        max: 1.5,
        step: 0.05
      },
      tailLength: {
        label: "Tail taper length",
        component: "slider",
        min: 0.3,
        max: 4,
        step: 0.05
      },
      radiusPulse: {
        label: "Body pulse (morph)",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      pulseWaves: {
        label: "Pulse waves along the body",
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
      stripes: {
        label: "Braid stripes (0 = plain skin)",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      stripeDepth: {
        label: "Stripe groove depth",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      twist: {
        label: "Stripe twist (turns along the body)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.05
      },
      spin: {
        label: "Stripe spin (snaps to whole turns/loop)",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion (dive behaviour)",
    fields: {
      apexHeight: {
        label: "Leap height (above the plate)",
        component: "slider",
        min: 0.15,
        max: 1.8,
        step: 0.01
      },
      diveDepth: {
        label: "Dive depth (below the plate)",
        component: "slider",
        min: 0.15,
        max: 1.8,
        step: 0.01
      },
      arcJitter: {
        label: "Per-arc height variety",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      hesitation: {
        label: "Hesitation (head hangs at the apex)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      flow: {
        label: "Flow (0 = periscope dives, 1 = slither through)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      swimX: {
        label: "Swim sway X",
        component: "slider",
        min: 0,
        max: 0.25,
        step: 0.005
      },
      swimZ: {
        label: "Swim sway Z",
        component: "slider",
        min: 0,
        max: 0.25,
        step: 0.005
      },
      swimWaves: {
        label: "Swim waves along the body",
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
        label: "Swim axis phase",
        component: "slider",
        min: 0,
        max: 6.2832,
        step: 0.01
      },
      swimDip: {
        label: "Swim pause at the holes (thread dead-centre)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  plate: {
    component: "nested-object",
    label: "Ice plate (frosted glass)",
    fields: {
      color: {
        label: "Plate color",
        component: "color"
      },
      alpha: {
        label: "Plate opacity",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      thickness: {
        label: "Plate thickness",
        component: "slider",
        min: 0.02,
        max: 0.6,
        step: 0.01
      },
      edgeSoftness: {
        label: "Hole rim softness (small = sharp)",
        component: "slider",
        min: 0.002,
        max: 0.25,
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
      tint: {
        label: "Plate iridescence",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      holeGlow: {
        label: "Hole rim glow",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      borderGlow: {
        label: "Plate edge glow",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      targetGlow: {
        label: "Next-hole telegraph glow",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      shadow: {
        label: "Dragon shadow on the plate",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      shadowSoft: {
        label: "Shadow softness",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      depthDim: {
        label: "Submerged murk (body below the ice)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      view: {
        label: "View",
        component: "select",
        options: [
          {
            label: "Orbit (whole scene)",
            value: "orbit"
          },
          {
            label: "Top (whack-a-mole)",
            value: "top"
          },
          {
            label: "Follow (chase the head)",
            value: "follow"
          },
          {
            label: "POV (ride the head)",
            value: "pov"
          }
        ]
      },
      distance: {
        label: "Orbit distance",
        component: "slider",
        min: 0.7,
        max: 3,
        step: 0.01
      },
      elevation: {
        label: "Orbit elevation (high = bird's-eye)",
        component: "slider",
        min: 0.12,
        max: 1.5,
        step: 0.01
      },
      orbitTurns: {
        label: "Orbit spin / loop (0 = static, snaps whole)",
        component: "slider",
        min: -2,
        max: 2,
        step: 1
      },
      orbitPhase: {
        label: "Orbit start angle",
        component: "slider",
        min: 0,
        max: 6.2832,
        step: 0.01
      },
      trackHead: {
        label: "Track the head (0 = locked on grid centre)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      followDistance: {
        label: "Follow distance",
        component: "slider",
        min: 0.5,
        max: 4,
        step: 0.05
      },
      followHeight: {
        label: "Follow height",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      aimAhead: {
        label: "Aim ahead of the head",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      smoothing: {
        label: "Camera smoothing (lazy chase)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      bank: {
        label: "Banking roll (follow/pov)",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      povLift: {
        label: "POV lift above the head",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      fov: {
        label: "Field of view °",
        component: "slider",
        min: 30,
        max: 100,
        step: 1
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
      bodyHueWaves: {
        label: "Hue waves along the body",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.05
      },
      stripeHueShift: {
        label: "Stripe hue shift",
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
  sound: {
    component: "nested-object",
    label: "Sound",
    fields: {
      splashEnabled: {
        label: "Splash on every crossing",
        component: "checkbox"
      },
      splashVolume: {
        label: "Splash volume",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      splashPitch: {
        label: "Splash pitch",
        component: "slider",
        min: 0.4,
        max: 2.5,
        step: 0.01
      },
      splashLength: {
        label: "Splash length (s)",
        component: "slider",
        min: 0.1,
        max: 1.2,
        step: 0.01
      },
      splashPan: {
        label: "Splash stereo pan",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      humEnabled: {
        label: "Dragon hum (constant)",
        component: "checkbox"
      },
      humVolume: {
        label: "Hum volume",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      humPitch: {
        label: "Hum pitch",
        component: "slider",
        min: 0.4,
        max: 2.5,
        step: 0.01
      }
    }
  },
  fogDensity: {
    label: "Fog density",
    component: "slider",
    min: 0,
    max: 0.4,
    step: 0.005
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
