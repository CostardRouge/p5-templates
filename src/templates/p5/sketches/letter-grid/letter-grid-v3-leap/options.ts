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
    value: "LEAP",
    seed: 1,
    alphabet: "letters" as "letters" | "lettersDigits" | "digits" | "custom",
    customAlphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  },
  grid: {
    font: "martian",
    letterScale: 0.71,
    sampleFactor: 0.24,
    // How many cells of terrain are kept around the hero.
    gridRadius: 6,
    // The next letter is searched for ~this many cells away — small = short hops.
    leapReach: 2.6
  },
  motion: {
    // Fraction of each step the letter rests grounded before springing off.
    dwell: 0.4,
    easing: "easeInOutCubic"
  },
  leap: {
    // Peak height of the arc, in cells.
    arcHeight: 2.6,
    // Whole turns the letter tumbles per leap (lands flat in the same orientation).
    spins: 1,
    tumbleEasing: "easeInOutCubic",
    // Fraction of the step by which the tumble + morph finish — the rest of the
    // descent is flat, so the letter lands cleanly instead of mid-spin.
    settle: 0.85,
    // Easing of the from→to letter morph.
    morphEasing: "easeInOutCubic",
    // Thickness of the extruded letter, in cells.
    extrudeHeight: 0.35,
    // Hero size relative to the terrain letters.
    heroScale: 1.5,
    // Emissive glow that keeps the hero brighter than the (unlit) terrain.
    glow: 0.5
  },
  light: {
    azimuth: 235,
    elevation: 50,
    intensity: 0.85,
    ambient: 0.45,
    color: [
      255,
      250,
      240
    ] as number[]
  },
  shadow: {
    opacity: 0.5,
    color: [
      0,
      0,
      0
    ] as number[]
  },
  camera: {
    // Scene rotation around each axis, degrees (full 0–360 turn on every axis).
    rotateX: 108,
    rotateY: 0,
    rotateZ: 0,
    distance: 1300,
    lift: 0,
    fov: 36
  },
  colors: {
    // The leaping letter's material.
    letter: [
      120,
      210,
      255,
      255
    ] as number[],
    // Dim glyphs of the surrounding terrain.
    grid: [
      58,
      58,
      74,
      255
    ] as number[],
    // Terrain glyph under the centre of the screen.
    focus: [
      110,
      110,
      135,
      255
    ] as number[],
    focusRadius: 2,
    focusEasing: "easeOutQuad",
    // The ground between the letters.
    ground: [
      20,
      20,
      28,
      255
    ] as number[]
  },
  vignette: {
    amount: 0.55,
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
      leapReach: {
        label: "Leap reach (cells)",
        component: "slider",
        min: 1.5,
        max: 8,
        step: 0.1
      }
    }
  },
  motion: {
    label: "Motion",
    component: "nested-object",
    fields: {
      dwell: {
        label: "Dwell grounded (fraction of step)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      easing: {
        label: "Travel easing",
        component: "easing"
      }
    }
  },
  leap: {
    label: "Leap",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      arcHeight: {
        label: "Arc height (cells)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.1
      },
      spins: {
        label: "Tumble turns per leap",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.25
      },
      tumbleEasing: {
        label: "Tumble easing",
        component: "easing"
      },
      settle: {
        label: "Settle (finish before landing)",
        component: "slider",
        min: 0.3,
        max: 1,
        step: 0.01
      },
      morphEasing: {
        label: "Morph easing",
        component: "easing"
      },
      extrudeHeight: {
        label: "Letter thickness (cells)",
        component: "slider",
        min: 0.02,
        max: 2,
        step: 0.01
      },
      heroScale: {
        label: "Hero size (× terrain)",
        component: "slider",
        min: 0.5,
        max: 3,
        step: 0.05
      },
      glow: {
        label: "Hero glow",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
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
        label: "Leaping letter",
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
        max: 6,
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
