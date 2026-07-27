
export const formValues = {
  timeScale: 1,
  vortex: {
    shrink: 0.78,
    swirlOffset: 2.4,
    fallSpeed: 1,
    steepness: 0.75,
    ringSpread: 0.3,
    hover: 0.3,
    drainFade: 0.28,
    octaveHueShift: 0.12
  },
  path: {
    waypointsPerLoop: 10,
    seed: 17,
    pose: 0.3,
    flow: 0.85,
    weave: true,
    heightJitter: 0.15,
    swimX: 0.06,
    swimY: 0.06,
    swimWaves: 3,
    swimSpeed: 2,
    swimPhase: 1.6
  },
  dragon: {
    bodyLength: 4.5,
    pipes: 5,
    pipeRadius: 0.065,
    braidRadius: 0.1,
    braidMerge: 0.5,
    headBulge: 0.35,
    headLength: 0.6,
    tailLength: 1.6,
    radiusPulse: 0.18,
    pulseWaves: 5,
    pulseTravel: -3,
    twist: 2,
    spin: -2
  },
  wall: {
    color: [
      30,
      42,
      70
    ],
    rim: 4.2,
    drainHole: 0.3,
    arms: 3,
    armPitch: 2,
    armSharpness: 5,
    streakGlow: 0.8,
    hueStep: 0.05,
    drainDarkness: 3,
    rimGlow: 0.25
  },
  camera: {
    view: "brink" as "brink" | "abyss" | "drift",
    distance: 1,
    elevation: 0.95,
    azimuth: 0.6,
    driftTurns: 1,
    fov: 50,
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
    azimuth: 2.4,
    elevation: 0.9,
    ambient: 0.3,
    diffuse: 1,
    specular: 0.6,
    specPower: 24,
    fresnelPower: 2.5,
    rimStrength: 0.5
  },
  sound: {
    eddyEnabled: false,
    eddyVolume: 0.6,
    eddyPitch: 1,
    eddyLength: 0.7,
    eddyPan: 0.7,
    humEnabled: false,
    humVolume: 0.5,
    humPitch: 0.7
  },
  fogDensity: 0.02,
  backgroundColor: [
    4,
    5,
    12
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
  vortex: {
    component: "nested-object",
    label: "Vortex (the screw)",
    fields: {
      shrink: {
        label: "Shrink per octave (deeper = smaller)",
        component: "slider",
        min: 0.5,
        max: 0.94,
        step: 0.01
      },
      swirlOffset: {
        label: "Swirl offset per octave (rad)",
        component: "slider",
        min: 0,
        max: 6.2832,
        step: 0.01
      },
      fallSpeed: {
        label: "Fall speed (octaves / loop, snaps whole)",
        component: "slider",
        min: 1,
        max: 3,
        step: 1
      },
      steepness: {
        label: "Funnel steepness",
        component: "slider",
        min: 0.2,
        max: 2,
        step: 0.01
      },
      ringSpread: {
        label: "Ring spread (radial wobble of the dance)",
        component: "slider",
        min: 0.05,
        max: 0.8,
        step: 0.01
      },
      hover: {
        label: "Hover above the wall",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      drainFade: {
        label: "Drain fade (deep copies go dark)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      octaveHueShift: {
        label: "Hue drift per octave of depth",
        component: "slider",
        min: -0.5,
        max: 0.5,
        step: 0.01
      }
    }
  },
  path: {
    component: "nested-object",
    label: "The dance (ring path)",
    fields: {
      waypointsPerLoop: {
        label: "Poses per loop (circling speed)",
        component: "slider",
        min: 4,
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
      weave: {
        label: "Weave (alternate inner/outer poses)",
        component: "checkbox"
      },
      heightJitter: {
        label: "Height wobble of the poses",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
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
  wall: {
    component: "nested-object",
    label: "Funnel wall",
    fields: {
      color: {
        label: "Wall color",
        component: "color"
      },
      rim: {
        label: "Bowl radius (the brink)",
        component: "slider",
        min: 2.5,
        max: 7,
        step: 0.05
      },
      drainHole: {
        label: "Open throat radius (0 = closed)",
        component: "slider",
        min: 0,
        max: 1.2,
        step: 0.01
      },
      arms: {
        label: "Spiral arms",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      armPitch: {
        label: "Arm pitch (turns per octave, snaps whole)",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      },
      armSharpness: {
        label: "Arm sharpness",
        component: "slider",
        min: 1,
        max: 16,
        step: 0.5
      },
      streakGlow: {
        label: "Arm glow",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      hueStep: {
        label: "Iridescent banding per octave",
        component: "slider",
        min: -0.4,
        max: 0.4,
        step: 0.01
      },
      drainDarkness: {
        label: "Drain darkness onset (octaves down)",
        component: "slider",
        min: 0.5,
        max: 8,
        step: 0.1
      },
      rimGlow: {
        label: "Brink lip glow",
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
            label: "Brink (over the rim, static)",
            value: "brink"
          },
          {
            label: "Abyss (straight down the throat, static)",
            value: "abyss"
          },
          {
            label: "Drift (slow orbit / loop)",
            value: "drift"
          }
        ]
      },
      distance: {
        label: "Distance (1 = the bowl fills the frame)",
        component: "slider",
        min: 0.4,
        max: 2.5,
        step: 0.01
      },
      elevation: {
        label: "Elevation (brink/drift)",
        component: "slider",
        min: 0.25,
        max: 1.5,
        step: 0.01
      },
      azimuth: {
        label: "Azimuth",
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
      eddyEnabled: {
        label: "Eddy whoosh on every pose",
        component: "checkbox"
      },
      eddyVolume: {
        label: "Eddy volume",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      eddyPitch: {
        label: "Eddy pitch",
        component: "slider",
        min: 0.4,
        max: 2.5,
        step: 0.01
      },
      eddyLength: {
        label: "Eddy length (s)",
        component: "slider",
        min: 0.1,
        max: 1.5,
        step: 0.01
      },
      eddyPan: {
        label: "Eddy stereo pan",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      humEnabled: {
        label: "Maelström roar (constant)",
        component: "checkbox"
      },
      humVolume: {
        label: "Roar volume",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      humPitch: {
        label: "Roar pitch",
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
