import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";
import {
  cameraFormValues,
  cameraFormConfiguration
} from "@/p5/utils/cameraRig.js";

// A sheet of points joined by thin tubes covers the canvas; the points that
// fall on a letter's ink rise, in a chosen order, and the tubes between them
// thicken — the text reads as a relief pushed up from under the sheet, one
// character per beat. Everything is a parameter: the field, the relief, the
// order and rhythm, the links and their readability rule, a cursor that lifts
// the sheet, and a camera whose every coordinate is a slider.
export const formValues = {
  timeScale: 1,

  text: {
    value: "SCULPT",
    font: "multicoloure",
    // Glyph height, as a fraction of the sheet's height.
    size: 0.78,
    // Thickens (> 0) or thins (< 0) the ink before the points read it.
    weight: 0,
    // What takes the stage each beat: a letter, a word, or the whole text.
    group: "letter" as "letter" | "word" | "all",
    // Glyph position on the sheet (fractions of its size).
    offset: {
      x: 0,
      y: 0
    }
  },

  field: {
    // Points across the sheet; rows follow the canvas aspect. 40 reads as a
    // mesh at 1080 wide; past ~56 the raised tubes merge into a plateau.
    density: 27,
    layout: "grid" as "grid" | "hex",
    // Seeded scatter of each point inside its cell (fraction of a cell).
    jitter: 0.3,
    seed: 7,
    // Slow coherent drift of the whole sheet (cells), whole cycles per loop.
    drift: 0.16,
    driftScale: 1,
    driftCycles: 1,
    // Radius of a junction bead at rest (fraction of a cell; 0 = tubes only).
    bead: 0.18
  },

  relief: {
    // Full elevation, world units (the sheet is 2 units tall).
    height: 0.7,
    // fill: every point on the ink · outline: a band along the contour.
    mask: "fill" as "fill" | "outline",
    band: 0.06,
    // flat plateau · dome (higher at the core of a stroke) · ridge (higher at
    // the edge) · noise.
    profile: "dome" as "flat" | "dome" | "ridge" | "noise",
    domeRadius: 0.05,
    // Partial height for points at the very edge of the ink.
    feather: 0.2
  },

  rhythm: {
    // Beats per loop = characters × repeats, so the loop always closes.
    repeats: 1,
    // Fraction of a beat the unit is held fully up before the handover.
    hold: 0.4,
    // sequential: fall, then rise · crossfade: both at once · morph: points in
    // both letters stay up, only the difference moves.
    transition: "morph" as "sequential" | "crossfade" | "morph"
  },

  rise: {
    order: "radial-out",
    // Sweep direction (radians) for the "sweep" order.
    angle: 0,
    // 0 = all points together, 0.95 = one after the other.
    spread: 0.6,
    easing: "easeOutBack"
  },

  fall: {
    // "mirror" reverses the rise order; any rise order is also accepted.
    order: "mirror",
    spread: 0.6,
    easing: "easeInCubic"
  },

  links: {
    // 4: orthogonal neighbours · 8: diagonals too.
    reach: "4" as "4" | "8",
    // ink: a link between raised points needs its midpoint on the ink ·
    // endpoints: two raised ends suffice.
    rule: "ink" as "ink" | "endpoints",
    // Tube radius at rest, as a fraction of the material thickness (0 = no
    // resting mesh, only beads).
    restWeight: 0.09,
    // Radius gained per unit of link weight (the lower of the two heights).
    gain: 0.9,
    // A link stretched past this many cells (drift, cursor) is dropped.
    maxLength: 1.8
  },

  material: {
    // Reference tube radius, as a fraction of a cell — so the look survives a
    // density change.
    thickness: 0.56,
    // Smooth-union fillet where tubes meet (fraction of a cell).
    fusion: 0.49
  },

  cursor: {
    // off · lift: a finger under the sheet · press: pushed down · attract:
    // points slide toward the cursor.
    mode: "lift" as "off" | "lift" | "press" | "attract",
    // Reach, as a fraction of the sheet height.
    radius: 0.22,
    strength: 0.6,
    falloff: "easeOutQuad",
    // Exponential lag: the sheet follows the hand rather than snapping.
    lag: 0.5
  },

  // Mouse + touch drive the cursor; camera hands are armed but off. With no
  // pointer the sheet is a pure function of the loop clock, so a headless
  // capture matches the preview.
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

  // The tangible camera (utils/cameraRig.js): tilt, spin, distance and every
  // coordinate are sliders, hence bindable; motion is whole cycles per loop.
  // `fit` frames the sheet's bounding sphere; 0.62 of that brings its edges
  // to the frame, so the sheet covers the canvas from the default tilt.
  camera: {
    ...cameraFormValues,
    tilt: 58,
    distance: 0.62,
    fogDensity: 0.05
  },

  colors: {
    hueSpeed: 0.5,
    hueSpread: 2,
    huePhase: 2.6,
    // The material's length hue shift runs along the height here.
    lengthHueShift: -0.6,
    pipeHueShift: 0.6,
    shimmer: 1.6,
    saturation: 0.8,
    brightness: 1.25
  },

  light: {
    azimuth: -1.1,
    elevation: 0.7,
    ambient: 0.3,
    diffuse: 0.75,
    specular: 1.1,
    specPower: 42,
    fresnelPower: 2.2,
    rimStrength: 0.6
  },

  rendering: {
    resolutionScale: 0.7
  },

  backgroundColor: [
    0,
    0,
    0
  ] as number[]
};

const orderOptions = [
  {
    value: "reading",
    label: "Reading (left → right)"
  },
  {
    value: "sweep",
    label: "Sweep (at an angle)"
  },
  {
    value: "radial-out",
    label: "Radial, out from the centre"
  },
  {
    value: "radial-in",
    label: "Radial, in to the centre"
  },
  {
    value: "spiral",
    label: "Spiral"
  },
  {
    value: "contour-in",
    label: "Contour first, then the core"
  },
  {
    value: "contour-out",
    label: "Core first, then the contour"
  },
  {
    value: "noise",
    label: "Noise"
  },
  {
    value: "random",
    label: "Random"
  }
];

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
        label: "Text (one beat per character)",
        component: "text"
      },
      font: {
        label: "Font",
        component: "select",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      size: {
        label: "Glyph height (fraction of the sheet)",
        component: "slider",
        min: 0.2,
        max: 1,
        step: 0.01
      },
      weight: {
        label: "Ink weight (thicken ↔ thin)",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.1
      },
      group: {
        label: "Per beat",
        component: "select",
        options: [
          {
            value: "letter",
            label: "One letter"
          },
          {
            value: "word",
            label: "One word"
          },
          {
            value: "all",
            label: "The whole text"
          }
        ]
      },
      offset: {
        label: "Glyph offset",
        component: "vector2d",
        min: -0.5,
        max: 0.5,
        step: 0.01,
        yDown: true
      }
    }
  },

  field: {
    component: "nested-object",
    label: "Sheet of points",
    fields: {
      density: {
        label: "Density (points across)",
        component: "slider",
        min: 12,
        max: 96,
        step: 1
      },
      layout: {
        label: "Layout",
        component: "select",
        options: [
          {
            value: "grid",
            label: "Grid"
          },
          {
            value: "hex",
            label: "Hex (odd rows shifted)"
          }
        ]
      },
      jitter: {
        label: "Jitter (fraction of a cell)",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      seed: {
        label: "Seed",
        component: "slider",
        min: 1,
        max: 99,
        step: 1
      },
      drift: {
        label: "Drift amount (cells)",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.01
      },
      driftScale: {
        label: "Drift scale (spatial)",
        component: "slider",
        min: 0.5,
        max: 8,
        step: 0.1
      },
      driftCycles: {
        label: "Drift cycles per loop",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      },
      bead: {
        label: "Bead radius (fraction of a cell)",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      }
    }
  },

  relief: {
    component: "nested-object",
    label: "Relief",
    fields: {
      height: {
        label: "Height (world units)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      mask: {
        label: "What rises",
        component: "select",
        options: [
          {
            value: "fill",
            label: "The ink (fill)"
          },
          {
            value: "outline",
            label: "A band along the contour"
          }
        ]
      },
      band: {
        label: "Contour band width",
        component: "slider",
        min: 0.02,
        max: 0.2,
        step: 0.005
      },
      profile: {
        label: "Profile",
        component: "select",
        options: [
          {
            value: "flat",
            label: "Flat plateau"
          },
          {
            value: "dome",
            label: "Dome (higher at the core)"
          },
          {
            value: "ridge",
            label: "Ridge (higher at the edge)"
          },
          {
            value: "noise",
            label: "Noise"
          }
        ]
      },
      domeRadius: {
        label: "Dome / ridge radius",
        component: "slider",
        min: 0.01,
        max: 0.15,
        step: 0.005
      },
      feather: {
        label: "Feather (soft edge)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },

  rhythm: {
    component: "nested-object",
    label: "Rhythm",
    fields: {
      repeats: {
        label: "Repeats per loop",
        component: "slider",
        min: 1,
        max: 4,
        step: 1
      },
      hold: {
        label: "Hold (fraction of a beat fully up)",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      transition: {
        label: "Handover",
        component: "select",
        options: [
          {
            value: "sequential",
            label: "Sequential (fall, then rise)"
          },
          {
            value: "crossfade",
            label: "Crossfade (both at once)"
          },
          {
            value: "morph",
            label: "Morph (shared points stay up)"
          }
        ]
      }
    }
  },

  rise: {
    component: "nested-object",
    label: "Rise",
    fields: {
      order: {
        label: "Order",
        component: "select",
        options: orderOptions
      },
      angle: {
        label: "Sweep angle",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      spread: {
        label: "Spread (0 = together, 0.95 = one by one)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      easing: {
        label: "Easing",
        component: "easing"
      }
    }
  },

  fall: {
    component: "nested-object",
    label: "Fall",
    fields: {
      order: {
        label: "Order",
        component: "select",
        options: [
          {
            value: "mirror",
            label: "Mirror of the rise"
          },
          ...orderOptions
        ]
      },
      spread: {
        label: "Spread",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      easing: {
        label: "Easing",
        component: "easing"
      }
    }
  },

  links: {
    component: "nested-object",
    label: "Links (tubes)",
    fields: {
      reach: {
        label: "Neighbourhood",
        component: "select",
        options: [
          {
            value: "4",
            label: "4 (orthogonal)"
          },
          {
            value: "8",
            label: "8 (with diagonals)"
          }
        ]
      },
      rule: {
        label: "Readability rule",
        component: "select",
        options: [
          {
            value: "ink",
            label: "Midpoint must be on the ink"
          },
          {
            value: "endpoints",
            label: "Two raised ends suffice"
          }
        ]
      },
      restWeight: {
        label: "Rest mesh weight (0 = none)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      gain: {
        label: "Thickening with elevation",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      maxLength: {
        label: "Max link length (cells)",
        component: "slider",
        min: 1,
        max: 3,
        step: 0.05
      }
    }
  },

  material: {
    component: "nested-object",
    label: "Material (tube)",
    fields: {
      thickness: {
        label: "Tube radius (fraction of a cell)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      fusion: {
        label: "Junction fusion (fraction of a cell)",
        component: "slider",
        min: 0.02,
        max: 1,
        step: 0.01
      }
    }
  },

  cursor: {
    component: "nested-object",
    label: "Cursor",
    fields: {
      mode: {
        label: "Mode",
        component: "select",
        options: [
          {
            value: "off",
            label: "Off"
          },
          {
            value: "lift",
            label: "Lift (a finger under the sheet)"
          },
          {
            value: "press",
            label: "Press (push the sheet down)"
          },
          {
            value: "attract",
            label: "Attract (points slide toward it)"
          }
        ]
      },
      radius: {
        label: "Reach (fraction of the sheet)",
        component: "slider",
        min: 0.02,
        max: 0.6,
        step: 0.01
      },
      strength: {
        label: "Strength",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      falloff: {
        label: "Falloff",
        component: "easing"
      },
      lag: {
        label: "Lag (0 = snaps, 0.95 = molasses)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      }
    }
  },

  // The modalities this sketch reads: mouse, touch, camera hands.
  interaction: {
    component: "nested-object",
    label: "Input sources",
    fields: {
      enabled: interactionFormConfiguration.fields.enabled,
      mouse: interactionFormConfiguration.fields.mouse,
      touch: interactionFormConfiguration.fields.touch,
      vision: interactionFormConfiguration.fields.vision
    }
  },

  camera: {
    ...cameraFormConfiguration,
    fields: {
      ...cameraFormConfiguration.fields,
      fogDensity: {
        label: "Fog density (from the sheet's centre)",
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
        min: -3,
        max: 3,
        step: 0.01
      },
      pipeHueShift: {
        label: "Across-the-sheet hue shift",
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
