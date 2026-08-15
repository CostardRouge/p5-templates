import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  interactionFormConfiguration, interactionFormValues
} from "@/p5/utils/interaction/defaults.js";
import {
  hoverSoundFormConfiguration, hoverSoundFormValues
} from "./hoverSoundOptions.js";

// One shader text watched over by a FORMATION of virtual cursors that never
// touch it: by default a circle of hands, aligned on an outer ring, that
// breathes — closing on the canvas centre and swelling back out, `cycles`
// times per loop — with a Lissajous curve and a horizontal/vertical wiper
// sweep as alternative flight plans. Every cursor is a small gravity well:
// a text point inside the attraction range leans toward the passing cursor
// (strength-capped, falloff-shaped) and the pull chases through an
// exponential lag (the gravity speed), so the word bulges and settles like
// jelly as the formation crosses it — no drag, no click, pure fly-by.
// Cursors flip to the `over` artwork while they cover a point, and each
// newly covered point can fire the "on over" sound — whose field ships
// EMPTY on purpose (no default chosen yet; drop a file on Sound → On over).
// Real pointers (mouse, touch, camera-seen fingertips) join in as extra
// gravity wells, so a hand waved over the word tugs it like the fly-bys do.
export const formValues = {
  timeScale: 1,

  text: {
    value: "orbit",
    font: "agiro",
    detail: 1,
    simplify: 0,
    // Points sampled along the text's outlines (split proportionally to
    // contour perimeter, ≥ 3 per ring) — these are the attractable points.
    handles: 56,
    // Baseline-to-baseline distance between the lines of a multi-line text,
    // in font-size units (vertical reels layouts).
    lineSpacing: 1.15
  },

  material: {
    size: 1.55,
    thickness: 0.03,
    fusion: 0.064
  },

  // The formation's flight plan. `cycles`, the spin and the Lissajous
  // frequencies snap to whole numbers so the loop always closes; stagger
  // and the phases are free offsets.
  movement: {
    mode: "circle",
    cycles: 2,
    phase: 0,
    stagger: 0,
    easing: "easeInOutCubic",
    circle: {
      radiusMin: 0.05,
      radiusMax: 0.95,
      rotation: 0,
      spinTurns: 0
    },
    lissajous: {
      freqX: 3,
      freqY: 2,
      phaseX: 0,
      phaseY: 0,
      amplitudeX: 0.85,
      amplitudeY: 0.85
    },
    sweep: {
      direction: "horizontal",
      span: 0.85,
      inset: 0.06
    }
  },

  // The cursors themselves: how many fly the formation, their artwork
  // (normal in flight, `over` while covering a point) and the hover circle
  // that decides the costume change + the "on over" sound.
  cursors: {
    count: 8,
    // Drawn size, normalized: × the artwork's natural resolution (the
    // shipped images are 256 px, so 0.4 ≈ 102 px on screen).
    scale: 0.4,
    hoverRadius: 55,
    images: {
      normal: "/assets/images/cursors/handpointing.png",
      over: "/assets/images/cursors/handopen.png"
    }
  },

  // The gravity of the fly-by: how hard a passing cursor tugs the text
  // points, from how far, with what well shape, and how fast the points
  // chase (and, once released, return home). At the top of the speed slider
  // the chase is instantaneous — a pure field, perfectly loop-safe.
  attraction: {
    strength: 70,
    range: 170,
    falloff: "smoothstep",
    speed: 9,
    // Real pointers (mouse, touch, camera fingertips) attract too.
    manual: true
  },

  // Mouse + touch + camera hands as extra gravity wells. Touch MUST stay
  // enabled so the viewport hands the touchscreen to the sketch instead of
  // panning. Vision is armed (Hands pre-selected) but starts OFF — flip
  // Vision → Enabled to tug the word by waving at the camera.
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

  // The sound of the fly-by: fired on each (cursor, point) hover edge. The
  // field ships empty on purpose — the right sound is still being chosen —
  // so the show stays silent until a file lands here.
  sound: {
    ...hoverSoundFormValues
  },

  // The usual hand-capture look for detected hands: a glowing spline through
  // the fingertips.
  hands: {
    show: false,
    weight: 14,
    glow: 2,
    iterations: 5,
    hueSpeed: 1.5,
    hueSpread: 2
  },

  camera: {
    fov: 30,
    distance: 11.8,
    // Auto-fit keeps any text (word or stacked block) in frame; switch it
    // off to drive the distance manually.
    autoFit: {
      enabled: true,
      margin: 0.2
    },
    phase: 0.15,
    elevation: 0.15,
    orbit: 0,
    sway: 0.04,
    swayCycles: 1,
    fogDensity: 0.06
  },

  colors: {
    hueSpeed: -0.12,
    hueSpread: 4.03,
    huePhase: 2.6,
    lengthHueShift: -0.25,
    pipeHueShift: 0.6,
    shimmer: 2.2,
    saturation: 0.9,
    brightness: 1.25
  },

  light: {
    azimuth: -1.1,
    elevation: 0.45,
    ambient: 0.3,
    diffuse: 0.75,
    specular: 1.1,
    specPower: 42,
    fresnelPower: 2.2,
    rimStrength: 0,
    shadowSoftness: 0
  },

  rendering: {
    resolutionScale: 1
  },

  overlay: {
    points: {
      show: true,
      size: 14,
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

  text: {
    component: "nested-object",
    label: "Text",
    fields: {
      value: {
        label: "Text (line breaks make stacked blocks)",
        component: "textarea"
      },
      font: {
        label: "Font",
        component: "select",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      detail: {
        label: "Outline detail (sample factor)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      simplify: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      handles: {
        label: "Points on the text",
        component: "slider",
        min: 12,
        max: 96,
        step: 1
      },
      lineSpacing: {
        label: "Line spacing (× font size)",
        component: "slider",
        min: 0.6,
        max: 2,
        step: 0.05
      }
    }
  },

  material: {
    component: "nested-object",
    label: "Material (tube)",
    fields: {
      size: {
        label: "Text size (world)",
        component: "slider",
        min: 0.5,
        max: 5,
        step: 0.05
      },
      thickness: {
        label: "Tube thickness",
        component: "slider",
        min: 0.005,
        max: 0.35,
        step: 0.005
      },
      fusion: {
        label: "Junction fusion (smooth-union fillet)",
        component: "slider",
        min: 0.001,
        max: 0.25,
        step: 0.001
      }
    }
  },

  movement: {
    component: "nested-object",
    label: "Formation flight",
    fields: {
      mode: {
        label: "Flight plan",
        component: "select",
        options: [
          {
            value: "circle",
            label: "Circle (breathes to the centre and back)"
          },
          {
            value: "lissajous",
            label: "Lissajous curve (beads on a wire)"
          },
          {
            value: "sweep",
            label: "Sweep (parallel lanes, out and back)"
          }
        ]
      },
      cycles: {
        label: "Cycles per loop (breaths / laps / sweeps)",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      phase: {
        label: "Cycle phase (shifts the whole formation's clock)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      stagger: {
        label: "Stagger (spreads the cursors' cycles apart)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      easing: {
        label: "Travel easing (shapes the breath / the sweep)",
        component: "easing"
      },
      circle: {
        component: "nested-object",
        label: "Circle",
        fields: {
          radiusMin: {
            label: "Inner radius (× half canvas, the tightest breath)",
            component: "slider",
            min: 0,
            max: 0.5,
            step: 0.01
          },
          radiusMax: {
            label: "Outer radius (× half canvas, the resting ring)",
            component: "slider",
            min: 0.1,
            max: 1.2,
            step: 0.01
          },
          rotation: {
            label: "Formation rotation (where cursor 0 sits)",
            component: "slider",
            min: -3.1416,
            max: 3.1416,
            step: 0.01
          },
          spinTurns: {
            label: "Spin (whole turns per loop, 0 = pure breathing)",
            component: "slider",
            min: -4,
            max: 4,
            step: 1
          }
        }
      },
      lissajous: {
        component: "nested-object",
        label: "Lissajous",
        fields: {
          freqX: {
            label: "X frequency (sine, whole numbers)",
            component: "slider",
            min: 1,
            max: 9,
            step: 1
          },
          freqY: {
            label: "Y frequency (cosine, whole numbers)",
            component: "slider",
            min: 1,
            max: 9,
            step: 1
          },
          phaseX: {
            label: "X phase",
            component: "slider",
            min: 0,
            max: 6.2832,
            step: 0.01
          },
          phaseY: {
            label: "Y phase",
            component: "slider",
            min: 0,
            max: 6.2832,
            step: 0.01
          },
          amplitudeX: {
            label: "X amplitude (× half canvas width)",
            component: "slider",
            min: 0.05,
            max: 1,
            step: 0.01
          },
          amplitudeY: {
            label: "Y amplitude (× half canvas height)",
            component: "slider",
            min: 0.05,
            max: 1,
            step: 0.01
          }
        }
      },
      sweep: {
        component: "nested-object",
        label: "Sweep",
        fields: {
          direction: {
            label: "Direction",
            component: "select",
            options: [
              {
                value: "horizontal",
                label: "Horizontal (lanes stacked vertically)"
              },
              {
                value: "vertical",
                label: "Vertical (lanes side by side)"
              }
            ]
          },
          span: {
            label: "Lane spread (× canvas, across the sweep)",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          },
          inset: {
            label: "Travel inset (× canvas, kept clear at both ends)",
            component: "slider",
            min: 0,
            max: 0.3,
            step: 0.01
          }
        }
      }
    }
  },

  cursors: {
    component: "nested-object",
    label: "Virtual cursors",
    fields: {
      count: {
        label: "Cursors in the formation",
        component: "slider",
        min: 1,
        max: 16,
        step: 1
      },
      scale: {
        label: "Image scale (× natural size)",
        component: "slider",
        min: 0.02,
        max: 1,
        step: 0.01
      },
      hoverRadius: {
        label: "Hover radius (px — the over state + sound trigger)",
        component: "slider",
        min: 5,
        max: 200,
        step: 1
      },
      images: {
        component: "nested-object",
        label: "Images",
        fields: {
          normal: {
            label: "Normal (in flight)",
            component: "image"
          },
          over: {
            label: "Over (covering a text point)",
            component: "image"
          }
        }
      }
    }
  },

  attraction: {
    component: "nested-object",
    label: "Attraction (the gravity of the fly-by)",
    fields: {
      strength: {
        label: "Strength (px — how far a point can be pulled)",
        component: "slider",
        min: 0,
        max: 400,
        step: 1
      },
      range: {
        label: "Range (px — how far a cursor reaches)",
        component: "slider",
        min: 20,
        max: 500,
        step: 1
      },
      falloff: {
        label: "Falloff (the well's shape, centre → rim)",
        component: "easing"
      },
      speed: {
        label: "Gravity speed (max = instant, perfectly loop-safe)",
        component: "slider",
        min: 0.5,
        max: 30,
        step: 0.5
      },
      manual: {
        label: "Real pointers attract too",
        component: "checkbox"
      }
    }
  },

  // Focused subset of the shared interaction form: only the modalities this
  // sketch reads (mouse, touch, camera hands).
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

  sound: hoverSoundFormConfiguration,

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
      distance: {
        label: "Distance (used when auto-fit is off)",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.05
      },
      autoFit: {
        component: "nested-object",
        label: "Auto-fit",
        fields: {
          enabled: {
            label: "Fit the distance to the text",
            component: "checkbox"
          },
          margin: {
            label: "Fit margin",
            component: "slider",
            min: 0,
            max: 1.5,
            step: 0.05
          }
        }
      },
      phase: {
        label: "Yaw (viewpoint angle)",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      elevation: {
        label: "Elevation (look down ↔ up at the text)",
        component: "slider",
        min: -1.4,
        max: 1.4,
        step: 0.01
      },
      orbit: {
        label: "Orbit turns per loop (0 = static camera)",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      },
      sway: {
        label: "Vertical sway amplitude (pitch)",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      swayCycles: {
        label: "Vertical sway cycles per loop",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      fogDensity: {
        label: "Fog density (depth cue on pushed points)",
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
        label: "Height hue shift",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      pipeHueShift: {
        label: "Outline hue shift",
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
        label: "Text shadows (0 = off, higher = harder)",
        component: "slider",
        min: 0,
        max: 64,
        step: 1
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
    label: "Point markers",
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
