import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

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
    // The word the camera spells, hopping letter to letter across the grid.
    value: "HELLO",
    // Seeds both the random grid and the path of cells visited.
    seed: 1,
    alphabet: "lettersDigits" as "letters" | "lettersDigits" | "digits" | "custom",
    // Used only when alphabet = "custom".
    customAlphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  },
  grid: {
    // How many cells span the shorter canvas edge. A fractional value leaves the
    // centre glyph large while neighbours peek in at the edges (the soft margin).
    cellsAcross: 5.4,
    font: "spaceMonoRegular",
    // Glyph size relative to a cell.
    letterScale: 0.62,
    // Subtle loop-periodic breathing zoom (0 = off).
    zoomPulse: 0
  },
  motion: {
    // Fraction of each letter-to-letter step spent resting on the letter.
    dwell: 0.45,
    easing: "easeInOutCubic",
    // How far beyond the viewport the next letter is hunted for (0 = just outside).
    searchSpread: 0.6
  },
  colors: {
    // Dim colour of the surrounding random glyphs.
    gridColor: [
      120,
      120,
      135,
      150
    ] as number[],
    // Colour of the glyph under the centre of the screen.
    focusColor: [
      255,
      255,
      255,
      255
    ] as number[],
    // Colour the spelled word's letters glow when locked on.
    accentColor: [
      120,
      200,
      255,
      255
    ] as number[],
    // Radius (in cells) of the centre-focus highlight falloff.
    focusRadius: 1.3,
    focusEasing: "easeOutQuad"
  },
  vignette: {
    amount: 0.85,
    radius: 0.42,
    softness: 0.5,
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
    label: "Grid & zoom",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      cellsAcross: {
        label: "Cells across (zoom)",
        component: "slider",
        min: 1,
        max: 14,
        step: 0.1
      },
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
      zoomPulse: {
        label: "Breathing zoom",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      }
    }
  },
  motion: {
    label: "Motion",
    component: "nested-object",
    initialExpanded: true,
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
        label: "Search reach (beyond viewport)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  colors: {
    label: "Colors & focus",
    component: "nested-object",
    fields: {
      gridColor: {
        label: "Grid glyphs",
        component: "color"
      },
      focusColor: {
        label: "Centred glyph",
        component: "color"
      },
      accentColor: {
        label: "Word accent",
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
