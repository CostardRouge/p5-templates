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

// ─────────────────────────────────────────────────────────────────────────────
// The form blocks the typographic grid sculpts (v5 … v9) share: the text, the
// sheet of points, the rhythm and its rise / fall, the material look, the
// cursor, the input sources, the camera, the iridescent palette, the lighting
// and the rendering scale. Each sketch spreads what it uses and adds its own
// blocks beside them, so the five forms read the same where they do the same
// thing and a preset's camera or palette moves between them unchanged.
// `sculpt-v2-letter-relief` spells all of this out inline and is left as is.
// ─────────────────────────────────────────────────────────────────────────────

export const textFormValues = {
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
};

export const textFormConfiguration = {
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
};

export const fieldFormValues = {
  // Points across the sheet; rows follow the canvas aspect.
  density: 40,
  layout: "grid" as "grid" | "hex",
  // Seeded scatter of each point inside its cell (fraction of a cell).
  jitter: 0.1,
  seed: 7,
  // Slow coherent drift of the whole sheet (cells), whole cycles per loop.
  drift: 0.05,
  driftScale: 1,
  driftCycles: 1
};

export const fieldFormFields = {
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
  }
};

export const orderOptions = [
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

export const rhythmFormValues = {
  // Beats per loop = characters × repeats, so the loop always closes.
  repeats: 1,
  // Fraction of a beat the unit is held before the handover.
  hold: 0.4,
  // sequential: fall, then rise · crossfade: both at once · morph: points in
  // both letters stay and only the difference moves.
  transition: "morph" as "sequential" | "crossfade" | "morph"
};

export const rhythmFormConfiguration = {
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
      label: "Hold (fraction of a beat held)",
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
          label: "Morph (shared points stay)"
        }
      ]
    }
  }
};

export const riseFormValues = {
  order: "radial-out",
  // Sweep direction (radians) for the "sweep" order.
  angle: 0,
  // 0 = all points together, 0.95 = one after the other.
  spread: 0.6,
  easing: "easeOutBack"
};

export const riseFormConfiguration = {
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
};

export const fallFormValues = {
  // "mirror" reverses the rise order; any rise order is also accepted.
  order: "mirror",
  spread: 0.6,
  easing: "easeInCubic"
};

export const fallFormConfiguration = {
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
};

// The look switch and its fringe sliders — a select plus three always-visible
// sliders, deliberately not a conditional-group (a branch switch rebuilds
// the whole block and resets the other sliders to their minima).
export const lookFormValues = {
  // tube: the lit material · fringe: only the rainbow bands every tube
  // carries at its silhouette — the artefact, kept on purpose.
  look: "tube" as "tube" | "fringe",
  fringeWidth: 1,
  fringeGlow: 3,
  fringeBody: 0.1
};

export const lookFormFields = {
  look: {
    label: "Look",
    component: "select",
    options: [
      {
        value: "tube",
        label: "Tube — the lit material"
      },
      {
        value: "fringe",
        label: "Fringe — the silhouette bands alone"
      }
    ]
  },
  fringeWidth: {
    label: "Fringe width (0.25 wide → 12 a hairline)",
    component: "slider",
    min: 0.25,
    max: 12,
    step: 0.05
  },
  fringeGlow: {
    label: "Fringe glow",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.05
  },
  fringeBody: {
    label: "Fringe body (0 = black inside the bands)",
    component: "slider",
    min: 0,
    max: 1,
    step: 0.01
  }
};

export const cursorFormValues = {
  // Reach, as a fraction of the sheet height.
  radius: 0.22,
  strength: 0.6,
  falloff: "easeOutQuad",
  // Exponential lag: the sheet follows the hand rather than snapping.
  lag: 0.5
};

export const cursorFormFields = {
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
};

// Mouse + touch drive the cursor; camera hands are armed but off. With no
// pointer the sheet is a pure function of the loop clock, so a headless
// capture matches the preview.
export const sheetInteractionFormValues = {
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
};

// The modalities these sketches read: mouse, touch, camera hands.
export const sheetInteractionFormConfiguration = {
  component: "nested-object",
  label: "Input sources",
  fields: {
    enabled: interactionFormConfiguration.fields.enabled,
    mouse: interactionFormConfiguration.fields.mouse,
    touch: interactionFormConfiguration.fields.touch,
    vision: interactionFormConfiguration.fields.vision
  }
};

// The tangible camera (utils/cameraRig.js): tilt, spin, distance and every
// coordinate are sliders, hence bindable; motion is whole cycles per loop.
// `fit` frames the sheet's bounding sphere; 0.62 of that brings its edges to
// the frame, so the sheet covers the canvas from the default tilt.
export const sheetCameraFormValues = {
  ...cameraFormValues,
  tilt: 58,
  distance: 0.62,
  fogDensity: 0.05
};

export const sheetCameraFormConfiguration = {
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
};

export const colorsFormValues = {
  hueSpeed: 0.5,
  hueSpread: 2,
  huePhase: 2.6,
  // The material's length hue shift runs along the height here.
  lengthHueShift: -0.6,
  pipeHueShift: 0.6,
  shimmer: 1.6,
  saturation: 0.8,
  brightness: 1.25
};

export const colorsFormConfiguration = {
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
};

export const lightFormValues = {
  azimuth: -1.1,
  elevation: 0.7,
  ambient: 0.3,
  diffuse: 0.75,
  specular: 1.1,
  specPower: 42,
  fresnelPower: 2.2,
  rimStrength: 0.6
};

export const lightFormConfiguration = {
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
};

export const renderingFormValues = {
  resolutionScale: 0.7
};

export const renderingFormConfiguration = {
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
};

export const backgroundColorFormConfiguration = {
  component: "color",
  label: "Background color"
};

export const timeScaleFormConfiguration = {
  label: "Time scale",
  component: "slider",
  min: 0,
  max: 5,
  step: 0.01
};
