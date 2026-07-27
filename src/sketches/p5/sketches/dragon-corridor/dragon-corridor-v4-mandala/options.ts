
export const formValues = {
  timeScale: 1,
  mandala: {
    sectors: 8,
    mirror: true,
    spin: 0,
    sectorHueShift: 0,
    innerRadius: 0.9,
    outerRadius: 2.6,
    depthRelief: 0.35
  },
  path: {
    waypointsPerLoop: 6,
    seed: 11,
    pose: 0.5,
    flow: 0.65,
    petalWeave: true,
    swimX: 0.05,
    swimY: 0.05,
    swimWaves: 3,
    swimSpeed: 2,
    swimPhase: 1.6
  },
  dragon: {
    bodyLength: 3,
    pipes: 5,
    pipeRadius: 0.05,
    braidRadius: 0.12,
    braidMerge: 0.5,
    headBulge: 0.35,
    headLength: 0.6,
    tailLength: 1.4,
    radiusPulse: 0.08,
    pulseWaves: 3,
    pulseTravel: -3,
    twist: 1.5,
    spin: -2
  },
  window: {
    alpha: 0.8,
    depth: 1.5,
    radius: 3.3,
    rings: 5,
    hueShift: 0.14,
    huePhase: 0.35,
    brightness: 0.35,
    centerGlow: 0.8,
    leadDarkness: 0.55,
    leadGlow: 0.5,
    frost: 0.5,
    frostScale: 3,
    dragonGlow: 0.7
  },
  camera: {
    view: "facade" as "facade" | "oblique" | "drift",
    distance: 1,
    elevation: 0.55,
    azimuth: 0.45,
    driftTurns: 1,
    fov: 45,
    quality: 0.75
  },
  colors: {
    hueSpeed: 1,
    hueSpread: 1.55,
    huePhase: 1.17,
    bodyHueWaves: 1.5,
    pipeHueShift: 0.33,
    shimmer: 1.1,
    saturation: 0.9,
    brightness: 1.05
  },
  light: {
    azimuth: 2.6,
    elevation: 0.6,
    ambient: 0.32,
    diffuse: 1,
    specular: 0.6,
    specPower: 24,
    fresnelPower: 2.5,
    rimStrength: 0.55
  },
  sound: {
    chimeEnabled: false,
    chimeVolume: 0.6,
    chimePitch: 1,
    chimeLength: 0.6,
    chimePan: 0.7,
    humEnabled: false,
    humVolume: 0.45,
    humPitch: 1
  },
  fogDensity: 0.015,
  backgroundColor: [
    5,
    6,
    14
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
  mandala: {
    component: "nested-object",
    label: "Kaleidoscope",
    fields: {
      sectors: {
        label: "Sectors (dragon copies)",
        component: "slider",
        min: 3,
        max: 12,
        step: 1
      },
      mirror: {
        label: "Mirror symmetry (twins kiss at the seams)",
        component: "checkbox"
      },
      spin: {
        label: "Rosette spin / loop (0 = still, snaps whole)",
        component: "slider",
        min: -2,
        max: 2,
        step: 1
      },
      sectorHueShift: {
        label: "Per-sector hue shift (0 = identical copies)",
        component: "slider",
        min: -1,
        max: 1,
        step: 0.01
      },
      innerRadius: {
        label: "Inner radius (hub the dance keeps clear)",
        component: "slider",
        min: 0.3,
        max: 2,
        step: 0.01
      },
      outerRadius: {
        label: "Outer radius (dance reach)",
        component: "slider",
        min: 1.2,
        max: 4,
        step: 0.01
      },
      depthRelief: {
        label: "Depth relief (petals lean out of the plane)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  path: {
    component: "nested-object",
    label: "The dance (path)",
    fields: {
      waypointsPerLoop: {
        label: "Poses per loop (speed)",
        component: "slider",
        min: 3,
        max: 16,
        step: 1
      },
      seed: {
        label: "Choreography seed",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      pose: {
        label: "Pose (settle on each figure)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      flow: {
        label: "Flow (0 = darts, 1 = calligraphy)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      petalWeave: {
        label: "Petal weave (alternate inner/outer poses)",
        component: "checkbox"
      },
      swimX: {
        label: "Swim sway X",
        component: "slider",
        min: 0,
        max: 0.25,
        step: 0.005
      },
      swimY: {
        label: "Swim sway Y",
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
      }
    }
  },
  dragon: {
    component: "nested-object",
    label: "Dragon (finite snake)",
    fields: {
      bodyLength: {
        label: "Body length (in poses, < poses/loop)",
        component: "slider",
        min: 1,
        max: 14,
        step: 0.5
      },
      pipes: {
        label: "Pipes (braid bundle size)",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      pipeRadius: {
        label: "Pipe radius",
        component: "slider",
        min: 0.02,
        max: 0.2,
        step: 0.005
      },
      braidRadius: {
        label: "Braid radius (pipe orbit)",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      },
      braidMerge: {
        label: "Head merge (braid → head)",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.05
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
      twist: {
        label: "Braid twist (turns along the body)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.05
      },
      spin: {
        label: "Braid spin (snaps to whole turns/loop)",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01
      }
    }
  },
  window: {
    component: "nested-object",
    label: "Rose window (stained glass)",
    fields: {
      alpha: {
        label: "Window opacity (0 = void behind)",
        component: "slider",
        min: 0,
        max: 0.97,
        step: 0.01
      },
      depth: {
        label: "Window distance behind the dance",
        component: "slider",
        min: 0.6,
        max: 4,
        step: 0.05
      },
      radius: {
        label: "Window radius",
        component: "slider",
        min: 1.5,
        max: 6,
        step: 0.05
      },
      rings: {
        label: "Stained-glass rings",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      hueShift: {
        label: "Hue shift per ring",
        component: "slider",
        min: -0.5,
        max: 0.5,
        step: 0.01
      },
      huePhase: {
        label: "Window hue phase",
        component: "slider",
        min: 0,
        max: 6.2832,
        step: 0.01
      },
      brightness: {
        label: "Glass brightness",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      centerGlow: {
        label: "Hub glow (light through the centre)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      leadDarkness: {
        label: "Lead lines darkness",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      leadGlow: {
        label: "Lead lines glow",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
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
        min: 0.5,
        max: 12,
        step: 0.25
      },
      dragonGlow: {
        label: "Dragon light on the glass",
        component: "slider",
        min: 0,
        max: 2,
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
            label: "Facade (rose window, static)",
            value: "facade"
          },
          {
            label: "Oblique (three-quarter, static)",
            value: "oblique"
          },
          {
            label: "Drift (slow orbit / loop)",
            value: "drift"
          }
        ]
      },
      distance: {
        label: "Distance (1 = rosette fills the frame)",
        component: "slider",
        min: 0.4,
        max: 2.5,
        step: 0.01
      },
      elevation: {
        label: "Elevation (oblique/drift)",
        component: "slider",
        min: -1.35,
        max: 1.35,
        step: 0.01
      },
      azimuth: {
        label: "Azimuth (oblique/drift)",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      driftTurns: {
        label: "Drift orbits / loop (snaps whole)",
        component: "slider",
        min: -2,
        max: 2,
        step: 1
      },
      fov: {
        label: "Field of view °",
        component: "slider",
        min: 25,
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
  sound: {
    component: "nested-object",
    label: "Sound",
    fields: {
      chimeEnabled: {
        label: "Chime on every pose",
        component: "checkbox"
      },
      chimeVolume: {
        label: "Chime volume",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      chimePitch: {
        label: "Chime pitch",
        component: "slider",
        min: 0.4,
        max: 2.5,
        step: 0.01
      },
      chimeLength: {
        label: "Chime length (s)",
        component: "slider",
        min: 0.1,
        max: 1.5,
        step: 0.01
      },
      chimePan: {
        label: "Chime stereo pan",
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
