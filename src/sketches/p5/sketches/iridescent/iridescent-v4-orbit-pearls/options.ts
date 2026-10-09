import {
  materialFormValues,
  materialFormConfiguration,
  backgroundFormValues,
  backgroundFormConfiguration
} from "../_iridescence.js";

// flowers-shaders-v5-orbit-pearls' geometry, pearls and camera, verbatim; its
// own spectrum / lighting blocks are replaced by the shared material, what
// feeds the material's extra channel (`colors`) and the pearls' wet sheen
// (`light`). The braid lives in world units of about 1, hence the fog range.
export const formValues = {
  timeScale: 1,
  braid: {
    pipeCount: 4,
    pipeRadius: 0.1,
    braidRadius: 0.56,
    twist: 0.51,
    spin: 1.56,
    radiusPulse: 0.47,
    pulseFreq: 0,
    pulseSpeed: 0
  },
  pearls: {
    count: 4,
    size: 0.21,
    speed: -0.81,
    swirl: -3,
    gravity: 0.35,
    orbitRadius: 1.06,
    phase: 0,
    spread: 1,
    deform: -1.5,
    deformRadius: 0.87,
    span: 7.5,
    tint: 0.35,
    brightness: 1.1,
    rampShift: 0.25
  },
  camera: {
    distance: 10,
    fov: 60,
    pitch: 0.03,
    yaw: -0.94,
    orbitSpeed: 0.21,
    fogDensity: 0.12
  },
  quality: {
    renderScale: 1
  },
  colors: {
    pipeShift: 0.5,
    lengthShift: 0.08
  },
  light: {
    specular: 0.6,
    specPower: 24,
    ao: 0.6
  },
  material: {
    ...materialFormValues,
    ramp: {
      ...materialFormValues.ramp,
      bands: 1
    },
    extra: 0.5,
    fog: {
      amount: 0,
      start: 10,
      end: 20
    }
  },
  background: backgroundFormValues
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
        label: "Ramp tint (0 = white nacre, 1 = the full ramp)",
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
      rampShift: {
        label: "Ramp offset between pearls",
        component: "slider",
        min: -1,
        max: 1,
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
        label: "Depth fade into the background",
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
    label: "Structure → colour (scaled by the material's slider)",
    fields: {
      pipeShift: {
        label: "Ramp offset between neighbouring pipes",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      lengthShift: {
        label: "Ramp drift along the braid's height",
        component: "slider",
        min: -1,
        max: 1,
        step: 0.01
      }
    }
  },
  light: {
    component: "nested-object",
    label: "Wet sheen",
    fields: {
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
      ao: {
        label: "Ambient occlusion",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  material: materialFormConfiguration( {
    extraLabel: "Pipe & height → colour",
    fogRange: {
      max: 30,
      step: 0.1
    }
  } ),
  background: backgroundFormConfiguration
};
