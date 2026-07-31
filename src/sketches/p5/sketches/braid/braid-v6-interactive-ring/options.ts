import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// The v5 Turk's-head weave woven around a DEFORMABLE ring: the centerline is a
// periodic spline through control points that are dragged on the canvas — with
// the mouse, a finger, or by PINCHING them with camera-tracked hands (several
// hands at once, each dragging its own point). Points are normalized 0..1 so
// they survive canvas resizes and are saved/exported with the template, same
// contract as splines-v2-draggable.
export const formValues = {
  timeScale: 1,

  points: {
    count: 8,
    seed: 7,
    // Normalized [0..1] control points. Drag on the canvas updates these; the
    // form's list edits them too. `count` / `seed` only regenerate the layout
    // (overwriting the list) when either changes.
    items: [
      {
        x: 0.5093134555590859,
        y: 0.2157030790665661
      },
      {
        x: 0.712,
        y: 0.288
      },
      {
        x: 0.8,
        y: 0.5
      },
      {
        x: 0.712,
        y: 0.712
      },
      {
        x: 0.5,
        y: 0.8
      },
      {
        x: 0.288,
        y: 0.712
      },
      {
        x: 0.2,
        y: 0.5
      },
      {
        x: 0.288,
        y: 0.288
      }
    ] as Array<{ x: number;
      y: number }>
  },

  grab: {
    // Pick-up radius (px) around a point: a press/touch/pinch within it grabs it.
    radius: 44,
    // Camera pinch: the thumb and index tips must be closer than this (px) to
    // count as "pressed". Released at 1.6× this (hysteresis).
    pinch: 70,
    // EMA lag on the pinch midpoint to calm jittery hand landmarks (0 = none,
    // higher = smoother but laggier). Mouse / touch stay unsmoothed.
    cameraSmoothing: 0.4
  },

  // Mouse + touch + camera hands drive the dragging. Touch MUST stay enabled
  // so the viewport hands the touchscreen to the sketch instead of panning.
  // Vision is armed (Hands pre-selected for the pinch) but starts OFF — flip
  // Vision → Enabled to grab points by pinching thumb + index; raise Max hands
  // to let a small crowd of hands sculpt the ring together.
  interaction: {
    ...interactionFormValues,
    mouse: {
      ...interactionFormValues.mouse,
      enabled: true
    },
    touch: {
      ...interactionFormValues.touch,
      enabled: true
    },
    vision: {
      ...interactionFormValues.vision,
      hands: {
        ...interactionFormValues.vision.hands,
        enabled: false,
        maxHands: 2,
        landmarks: {
          fingertips: true,
          palm: false
        }
      }
    },
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false
    },
    visualization: {
      ...interactionFormValues.visualization,
      enabled: false
    }
  },

  // The usual hand-capture look for detected hands: a glowing spline through
  // the fingertips, plus the per-hand pinch markers (always on).
  hands: {
    show: false,
    weight: 14,
    glow: 2,
    iterations: 5,
    hueSpeed: 1.5,
    hueSpread: 2
  },

  weave: {
    strands: 2,
    leads: 2,
    wireRadius: 0.11,
    depth: 0.05,
    minorRadius: 0.39,
    spin: -2.3
  },

  camera: {
    distance: 15.7,
    fov: 45,
    fogDensity: 0.175
  },

  colors: {
    hueSpeed: 0.5,
    hueSpread: 3.16,
    huePhase: 2.6,
    lengthHueShift: 0.35,
    pipeHueShift: 0.5,
    shimmer: 1.86,
    saturation: 0.75,
    brightness: 1.3
  },

  light: {
    azimuth: -0.51,
    elevation: 0.5,
    ambient: 0.13,
    diffuse: 0.76,
    specular: 0.81,
    specPower: 48,
    fresnelPower: 2.56,
    rimStrength: 0,
    shadowSoftness: 64
  },

  aberration: {
    amount: 0,
    mode: "radial" as "radial" | "horizontal"
  },

  rendering: {
    resolutionScale: 0.7
  },

  overlay: {
    points: {
      show: true,
      size: 18,
      coreRatio: 0.5,
      color: [
        255,
        255,
        255,
        255
      ] as number[],
      coreColor: [
        10,
        10,
        14,
        255
      ] as number[]
    }
  },

  backgroundColor: [
    0,
    0,
    0
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  timeScale: {
    label: "Time scale",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.01
  },

  points: {
    label: "Control points",
    component: "nested-object",
    fields: {
      count: {
        label: "Count (regenerates the layout)",
        component: "slider",
        min: 3,
        max: 12,
        step: 1
      },
      seed: {
        label: "Random seed (regenerates the layout)",
        component: "slider",
        min: 0,
        max: 100,
        step: 1
      },
      items: {
        label: "Points (normalized 0..1)",
        component: "item-list",
        minItems: 3,
        maxItems: 12,
        itemConfig: {
          label: "Point",
          component: "vector2d",
          min: 0,
          max: 1,
          step: 0.001,
          yDown: true
        }
      }
    }
  },

  grab: {
    label: "Grab",
    component: "nested-object",
    fields: {
      radius: {
        label: "Pick-up radius (px)",
        component: "slider",
        min: 10,
        max: 120,
        step: 1
      },
      pinch: {
        label: "Camera pinch distance (px)",
        component: "slider",
        min: 20,
        max: 200,
        step: 1
      },
      cameraSmoothing: {
        label: "Camera smoothing",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.05
      }
    }
  },

  // Focused subset of the shared interaction form: only the modalities this
  // sketch reads (mouse, touch, camera hands). The Max-hands slider is widened
  // beyond the shared default so a whole crowd of hands can sculpt at once.
  interaction: {
    component: "nested-object",
    label: "Input sources",
    fields: {
      enabled: interactionFormConfiguration.fields.enabled,
      mouse: interactionFormConfiguration.fields.mouse,
      touch: interactionFormConfiguration.fields.touch,
      vision: {
        ...interactionFormConfiguration.fields.vision,
        fields: {
          ...interactionFormConfiguration.fields.vision.fields,
          hands: {
            ...interactionFormConfiguration.fields.vision.fields.hands,
            fields: {
              ...interactionFormConfiguration.fields.vision.fields.hands.fields,
              maxHands: {
                component: "slider",
                label: "Max hands",
                min: 1,
                max: 10,
                step: 1
              }
            }
          }
        }
      }
    }
  },

  hands: {
    label: "Hand visuals",
    component: "nested-object",
    fields: {
      show: {
        label: "Show hand ribbons",
        component: "checkbox"
      },
      weight: {
        label: "Ribbon weight",
        component: "slider",
        min: 2,
        max: 40,
        step: 0.5
      },
      glow: {
        label: "Glow layers",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      iterations: {
        label: "Chaikin iterations",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      hueSpeed: {
        label: "Hue speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.05
      }
    }
  },

  weave: {
    component: "nested-object",
    label: "Braid weave",
    fields: {
      strands: {
        label: "Strands per family",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      leads: {
        label: "Leads (poloidal wraps, snaps to whole)",
        component: "slider",
        min: 2,
        max: 20,
        step: 1
      },
      wireRadius: {
        label: "Strand thickness",
        component: "slider",
        min: 0.03,
        max: 0.2,
        step: 0.005
      },
      depth: {
        label: "Weave depth (auto-floored for clearance)",
        component: "slider",
        min: 0.05,
        max: 0.4,
        step: 0.01
      },
      minorRadius: {
        label: "Lay radius (auto-floored for clearance)",
        component: "slider",
        min: 0.2,
        max: 1,
        step: 0.01
      },
      spin: {
        label: "Weave roll (snaps to whole turns/loop)",
        component: "slider",
        min: -6,
        max: 6,
        step: 0.1
      }
    }
  },

  camera: {
    component: "nested-object",
    label: "Camera (face-on lock)",
    fields: {
      distance: {
        label: "Distance (zoom)",
        component: "slider",
        min: 6,
        max: 20,
        step: 0.05
      },
      fov: {
        label: "Field of view °",
        component: "slider",
        min: 20,
        max: 90,
        step: 1
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
        label: "Strand hue shift",
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

  overlay: {
    label: "Control point markers",
    component: "nested-object",
    fields: {
      points: {
        label: "Points",
        component: "nested-object",
        fields: {
          show: {
            label: "Show points",
            component: "checkbox"
          },
          size: {
            label: "Size (diameter)",
            component: "slider",
            min: 0,
            max: 60,
            step: 0.5
          },
          coreRatio: {
            label: "Inner core ratio",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.02
          },
          color: {
            label: "Color",
            component: "color"
          },
          coreColor: {
            label: "Inner core color",
            component: "color"
          }
        }
      }
    }
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
