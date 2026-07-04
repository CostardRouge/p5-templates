import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

const ALPHABET_OPTIONS = [
  {
    label: "Letters (A–Z)",
    value: "letters"
  },
  {
    label: "Letters + digits",
    value: "lettersDigits"
  },
  {
    label: "Digits (0–9)",
    value: "digits"
  },
  {
    label: "Custom",
    value: "custom"
  }
];

export const formValues = {
  word: {
    value: "RISE",
    seed: 1,
    alphabet: "letters" as "letters" | "lettersDigits" | "digits" | "custom",
    customAlphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  },
  grid: {
    font: "martian",
    letterScale: 0.77,
    // Outline sampling precision for the extruded glyphs (lower = smoother caps).
    sampleFactor: 0.22,
    // How many cells around the reading head are kept in the terrain / liftable.
    gridRadius: 7,
    // The next letter is searched for beyond this many cells (off-screen).
    searchViewRadius: 4.5
  },
  motion: {
    dwell: 0.37,
    easing: "easeInOutCubic",
    searchSpread: 0.01
  },
  extrude: {
    // Extrusion height of a fully-raised letter, in cells.
    height: 0.7
  },
  elevation: {
    // Scales the lift height of the targeted letter(s).
    multiplier: 1.15,
    // Reach of the lift, in cells: ~0 raises only the centred letter, larger
    // values raise neighbours then cells further out.
    spread: 4.4,
    falloff: "easeInCirc",
    // Safety cap on simultaneously extruded cells (performance).
    maxCells: 66
  },
  light: {
    // Compass direction the light comes from, degrees.
    azimuth: 59,
    // Height above the horizon, degrees (drives how long the shadows are).
    elevation: 28,
    intensity: 0.85,
    ambient: 0.35,
    color: [
      255,
      250,
      240
    ] as number[]
  },
  shadow: {
    opacity: 0.27,
    softness: 0,
    color: [
      0,
      0,
      0
    ] as number[]
  },
  camera: {
    // Scene rotation around each axis, degrees (full 0–360 turn on every axis).
    // rotateX pitches the ground into view, rotateY spins it, rotateZ rolls it.
    rotateX: 121,
    rotateY: 19,
    rotateZ: 6,
    distance: 1260,
    // Vertical framing offset of the look-at point.
    lift: 230,
    fov: 36
  },
  colors: {
    // Raised-letter material.
    letter: [
      98,
      244,
      227,
      255
    ] as number[],
    // The spelled word's letters glow this colour.
    accent: [
      120,
      200,
      255,
      255
    ] as number[],
    // Dim glyphs of the surrounding terrain.
    grid: [
      135,
      135,
      155,
      255
    ] as number[],
    // Terrain glyph under the centre of the screen.
    focus: [
      235,
      235,
      245,
      255
    ] as number[],
    focusRadius: 1.3,
    focusEasing: "easeOutQuad",
    // The ground between the letters.
    ground: [
      26,
      26,
      36,
      255
    ] as number[]
  },
  vignette: {
    amount: 0.6,
    radius: 0.5,
    softness: 0.6,
    color: [
      8,
      8,
      12,
      255
    ] as number[]
  },
  backgroundColor: [
    8,
    8,
    12,
    255
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  word: {
    label: "Word",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      value: {
        label: "Word to spell",
        component: "textarea"
      },
      seed: {
        label: "Seed",
        component: "slider",
        min: 0,
        max: 9999,
        step: 1
      },
      alphabet: {
        label: "Grid alphabet",
        component: "select",
        options: ALPHABET_OPTIONS
      },
      customAlphabet: {
        label: "Custom alphabet (when \"Custom\")",
        component: "textarea"
      }
    }
  },
  grid: {
    label: "Grid",
    component: "nested-object",
    fields: {
      font: {
        label: "Font",
        component: "select",
        options: fontSelectOptions
      },
      letterScale: {
        label: "Letter size (× cell)",
        component: "slider",
        min: 0.1,
        max: 1.4,
        step: 0.01
      },
      sampleFactor: {
        label: "Outline precision",
        component: "slider",
        min: 0.05,
        max: 0.5,
        step: 0.01
      },
      gridRadius: {
        label: "Terrain radius (cells)",
        component: "slider",
        min: 3,
        max: 12,
        step: 1
      },
      searchViewRadius: {
        label: "Search reach (cells)",
        component: "slider",
        min: 2,
        max: 12,
        step: 0.5
      }
    }
  },
  motion: {
    label: "Motion",
    component: "nested-object",
    fields: {
      dwell: {
        label: "Dwell on letter (fraction of step)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      easing: {
        label: "Travel easing",
        component: "easing"
      },
      searchSpread: {
        label: "Search spread (beyond viewport)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  extrude: {
    label: "Extrusion",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      height: {
        label: "Height (× cell)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      }
    }
  },
  elevation: {
    label: "Elevation field",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      multiplier: {
        label: "Lift multiplier",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      spread: {
        label: "Spread (cells involved)",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.05
      },
      falloff: {
        label: "Falloff easing",
        component: "easing"
      },
      maxCells: {
        label: "Max raised cells",
        component: "slider",
        min: 1,
        max: 120,
        step: 1
      }
    }
  },
  light: {
    label: "Light",
    component: "nested-object",
    fields: {
      azimuth: {
        label: "Azimuth (°)",
        component: "slider",
        min: 0,
        max: 360,
        step: 1
      },
      elevation: {
        label: "Elevation (°)",
        component: "slider",
        min: 5,
        max: 89,
        step: 1
      },
      intensity: {
        label: "Intensity",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      ambient: {
        label: "Ambient",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      color: {
        label: "Light color",
        component: "color"
      }
    }
  },
  shadow: {
    label: "Shadow",
    component: "nested-object",
    fields: {
      opacity: {
        label: "Opacity",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      softness: {
        label: "Softness",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      color: {
        label: "Shadow color",
        component: "color"
      }
    }
  },
  camera: {
    label: "Camera",
    component: "nested-object",
    fields: {
      rotateX: {
        label: "Rotate X / tilt (°)",
        component: "slider",
        min: 0,
        max: 360,
        step: 1
      },
      rotateY: {
        label: "Rotate Y / spin (°)",
        component: "slider",
        min: 0,
        max: 360,
        step: 1
      },
      rotateZ: {
        label: "Rotate Z / roll (°)",
        component: "slider",
        min: 0,
        max: 360,
        step: 1
      },
      distance: {
        label: "Distance",
        component: "slider",
        min: 200,
        max: 2500,
        step: 10
      },
      lift: {
        label: "Vertical framing",
        component: "slider",
        min: -600,
        max: 600,
        step: 10
      },
      fov: {
        label: "Field of view (°)",
        component: "slider",
        min: 10,
        max: 90,
        step: 1
      }
    }
  },
  colors: {
    label: "Colors",
    component: "nested-object",
    fields: {
      letter: {
        label: "Raised letter",
        component: "color"
      },
      accent: {
        label: "Word accent",
        component: "color"
      },
      grid: {
        label: "Terrain glyphs",
        component: "color"
      },
      focus: {
        label: "Centred glyph",
        component: "color"
      },
      focusRadius: {
        label: "Focus radius (cells)",
        component: "slider",
        min: 0.3,
        max: 5,
        step: 0.05
      },
      focusEasing: {
        label: "Focus falloff easing",
        component: "easing"
      },
      ground: {
        label: "Ground",
        component: "color"
      }
    }
  },
  vignette: {
    label: "Vignette",
    component: "nested-object",
    fields: {
      amount: {
        label: "Strength",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      radius: {
        label: "Clear radius",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      softness: {
        label: "Softness",
        component: "slider",
        min: 0.01,
        max: 1.5,
        step: 0.01
      },
      color: {
        label: "Vignette color",
        component: "color"
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
