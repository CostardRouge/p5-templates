// A thread of smoke rising from an ember: the plume, the air that breaks it
// up, the lamp that lights it and the backdrop. Angles are in degrees and
// colours are screen colours; index.js converts both.
export const formValues = {
  plume: {
    size: 1.05,
    baseY: -0.42,
    top: 1.25,
    fadeStart: 0.75,
    width: 0.09,
    spread: 0.16,
    ribbon: 0.3,
    breakHeight: 0.38,
    twist: 5,
    spinTurns: 1,
    meander: 0.035,
    meanderWaves: 1.6,
    meanderSpeed: 2,
    lean: 0.02,
    dilution: 1
  },
  air: {
    eddies: 0.26,
    eddyScale: 2.2,
    eddySpeed: 2,
    erosion: 0.75,
    grain: 4.5,
    stretch: 0.5,
    detail: 4,
    roughness: 0.55,
    softness: 0.4,
    speed: 4,
    shear: 1
  },
  light: {
    density: 18,
    smokeColor: [
      214,
      220,
      232
    ],
    keyPower: 2.1,
    keyColor: [
      255,
      240,
      222
    ],
    keyDirection: -55,
    keyHeight: 25,
    shadow: 4,
    through: 1.4,
    ambient: [
      34,
      36,
      42
    ],
    ember: 4,
    emberColor: [
      255,
      120,
      30
    ],
    emberSize: 0.012,
    emberFlicker: 0.3,
    exposure: 1.1
  },
  backdrop: {
    top: [
      9,
      10,
      14
    ],
    bottom: [
      2,
      2,
      3
    ],
    glow: 0.02
  },
  quality: {
    renderScale: 0.65,
    steps: 44
  }
};

export const formConfiguration: Record<string, any> = {
  plume: {
    component: "nested-object",
    label: "Plume",
    fields: {
      size: {
        label: "Height (\u00d7 the canvas height)",
        component: "slider",
        min: 0.2,
        max: 1.6,
        step: 0.01
      },
      baseY: {
        label: "Ember position (canvas heights from the centre, up is +)",
        component: "slider",
        min: -0.6,
        max: 0.3,
        step: 0.01
      },
      top: {
        label: "Where it is gone (\u00d7 its height)",
        component: "slider",
        min: 0.5,
        max: 2,
        step: 0.01
      },
      fadeStart: {
        label: "Where it starts to fade",
        component: "slider",
        min: 0.2,
        max: 1.9,
        step: 0.01
      },
      width: {
        label: "Width where it has broken up",
        component: "slider",
        min: 0.01,
        max: 0.3,
        step: 0.002
      },
      spread: {
        label: "Spread (how fast it widens)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.005
      },
      ribbon: {
        label: "Ribbon (thread thickness \u00f7 width at the ember; 1 = round)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      breakHeight: {
        label: "Break height (where the smooth thread turns to billows)",
        component: "slider",
        min: 0.05,
        max: 1.5,
        step: 0.01
      },
      twist: {
        label: "Twist (radians of turn per plume height)",
        component: "slider",
        min: -20,
        max: 20,
        step: 0.1
      },
      spinTurns: {
        label: "Whole turns per loop",
        component: "slider",
        min: -3,
        max: 3,
        step: 1
      },
      meander: {
        label: "Meander (the thread's slow S)",
        component: "slider",
        min: 0,
        max: 0.2,
        step: 0.002
      },
      meanderWaves: {
        label: "Meander waves along the height",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.05
      },
      meanderSpeed: {
        label: "Meander wavelengths climbed per loop",
        component: "slider",
        min: -6,
        max: 6,
        step: 1
      },
      lean: {
        label: "Lean (a draught from the side)",
        component: "slider",
        min: -0.4,
        max: 0.4,
        step: 0.005
      },
      dilution: {
        label: "Dilution (thins with height)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.05
      }
    }
  },
  air: {
    component: "nested-object",
    label: "Air",
    fields: {
      eddies: {
        label: "Eddies (how far the air carries the plume sideways)",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.005
      },
      eddyScale: {
        label: "Eddy grain (cells per plume height)",
        component: "slider",
        min: 0.5,
        max: 8,
        step: 0.05
      },
      eddySpeed: {
        label: "Eddy rise (whole periods per loop)",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      erosion: {
        label: "Billows (how much they eat the plume)",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      grain: {
        label: "Billow grain (cells per plume height)",
        component: "slider",
        min: 1,
        max: 20,
        step: 0.1
      },
      stretch: {
        label: "Vertical stretch (lower = longer wisps)",
        component: "slider",
        min: 0.15,
        max: 1.5,
        step: 0.01
      },
      detail: {
        label: "Detail (octaves)",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      },
      roughness: {
        label: "Roughness",
        component: "slider",
        min: 0.2,
        max: 0.8,
        step: 0.01
      },
      softness: {
        label: "Edge softness",
        component: "slider",
        min: 0.02,
        max: 1,
        step: 0.01
      },
      speed: {
        label: "Rise (whole noise periods per loop)",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      shear: {
        label: "Shear (extra periods per octave)",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      }
    }
  },
  light: {
    component: "nested-object",
    label: "Light",
    fields: {
      density: {
        label: "Smoke density",
        component: "slider",
        min: 1,
        max: 120,
        step: 0.5
      },
      smokeColor: {
        label: "Smoke colour",
        component: "color"
      },
      keyPower: {
        label: "Lamp",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.05
      },
      keyColor: {
        label: "Lamp colour",
        component: "color"
      },
      keyDirection: {
        label: "Lamp direction (\u00b0; 0 is behind the smoke, 180 behind the camera)",
        component: "slider",
        min: -180,
        max: 180,
        step: 1
      },
      keyHeight: {
        label: "Lamp height (\u00b0)",
        component: "slider",
        min: -60,
        max: 80,
        step: 1
      },
      shadow: {
        label: "Self-shadow (how fast smoke shades itself)",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.05
      },
      through: {
        label: "Backlight boost (brighter with the lamp behind)",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.05
      },
      ambient: {
        label: "Room light",
        component: "color"
      },
      ember: {
        label: "Ember",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.05
      },
      emberColor: {
        label: "Ember colour",
        component: "color"
      },
      emberSize: {
        label: "Ember size",
        component: "slider",
        min: 0.002,
        max: 0.08,
        step: 0.001
      },
      emberFlicker: {
        label: "Ember flicker",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
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
        label: "Glow behind the plume",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.005
      }
    }
  },
  quality: {
    component: "nested-object",
    label: "Quality",
    fields: {
      renderScale: {
        label: "Render scale (lower = faster; smoke is soft anyway)",
        component: "slider",
        min: 0.3,
        max: 1,
        step: 0.05
      },
      steps: {
        label: "Depth slices",
        component: "slider",
        min: 8,
        max: 96,
        step: 1
      }
    }
  }
};
