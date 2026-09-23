import {
  textFormValues,
  textFormConfiguration,
  fieldFormValues,
  fieldFormFields,
  rhythmFormValues,
  rhythmFormConfiguration,
  riseFormValues,
  riseFormConfiguration,
  fallFormValues,
  fallFormConfiguration,
  lookFormValues,
  lookFormFields,
  cursorFormValues,
  cursorFormFields,
  sheetInteractionFormValues,
  sheetInteractionFormConfiguration,
  sheetCameraFormValues,
  sheetCameraFormConfiguration,
  colorsFormValues,
  colorsFormConfiguration,
  lightFormValues,
  lightFormConfiguration,
  renderingFormValues,
  renderingFormConfiguration,
  backgroundColorFormConfiguration,
  timeScaleFormConfiguration
} from "../_form";

// A grid of dots, one per cell, each sized by the ink under its cell: a
// halftone of the letter, whose dots swell until they touch and melt into one
// slab on the ink and sit quietly at their rest size off it. Spheres or
// rounded boxes, spinning or twisted; each beat the dots shrink and regrow to
// the next character in an order.
export const formValues = {
  timeScale: 1,

  text: {
    ...textFormValues
  },

  field: {
    ...fieldFormValues,
    density: 36,
    jitter: 0,
    drift: 0
  },

  dots: {
    shape: "sphere" as "sphere" | "box",
    // Radius off the ink (fraction of a cell; 0 = no rest grid).
    rest: 0.1,
    // Radius gained at full coverage (fraction of a cell): past 0.4 the dots
    // on the ink touch and fuse.
    gain: 0.38,
    // Halftone curve: coverage ^ gamma (< 1 fattens the edge dots).
    gamma: 1,
    // Supersamples per side when reading the ink's area under a cell.
    samples: 4,
    // Box corner rounding (fraction of the radius; 1 = a pill).
    rounding: 0.5,
    // Stretch every dot along its angle (fraction of a cell).
    elongation: 0,
    // Whole turns per loop of every dot (visible on boxes).
    spin: 0,
    // Extra angle across the sheet (radians per sheet unit).
    twist: 0,
    // Half-turns a dot makes while handing over to the next character.
    flip: 0,
    // A slow up-and-down of the dots (fraction of a cell), whole cycles.
    bob: 0.06,
    bobScale: 2.5,
    bobCycles: 1
  },

  relief: {
    // Lift of the dots with their coverage (world units, 0 = flat).
    height: 0
  },

  rhythm: {
    ...rhythmFormValues,
    hold: 0.45
  },

  rise: {
    ...riseFormValues,
    order: "sweep",
    spread: 0.7,
    easing: "easeOutBack"
  },

  fall: {
    ...fallFormValues,
    spread: 0.7,
    easing: "easeInCubic"
  },

  material: {
    ...lookFormValues,
    // Smooth-union fillet between touching dots (fraction of a cell).
    fusion: 0.35
  },

  cursor: {
    // off · swell: dots grow under the finger · attract: they slide toward it.
    mode: "swell" as "off" | "swell" | "attract",
    ...cursorFormValues
  },

  interaction: {
    ...sheetInteractionFormValues
  },

  camera: {
    ...sheetCameraFormValues
  },

  colors: {
    ...colorsFormValues
  },

  light: {
    ...lightFormValues
  },

  rendering: {
    ...renderingFormValues
  },

  backgroundColor: [
    0,
    0,
    0
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  timeScale: timeScaleFormConfiguration,

  text: textFormConfiguration,

  field: {
    component: "nested-object",
    label: "Grid of dots",
    fields: fieldFormFields
  },

  dots: {
    component: "nested-object",
    label: "Dots",
    fields: {
      shape: {
        label: "Shape",
        component: "select",
        options: [
          {
            value: "sphere",
            label: "Sphere"
          },
          {
            value: "box",
            label: "Rounded box"
          }
        ]
      },
      rest: {
        label: "Rest radius, off the ink (fraction of a cell)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      gain: {
        label: "Radius gained on the ink (fraction of a cell)",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      gamma: {
        label: "Halftone curve (coverage ^ gamma)",
        component: "slider",
        min: 0.2,
        max: 4,
        step: 0.05
      },
      samples: {
        label: "Coverage samples per side",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      rounding: {
        label: "Box rounding (1 = a pill)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      elongation: {
        label: "Elongation along the angle (cells)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      spin: {
        label: "Spin (whole turns per loop)",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      },
      twist: {
        label: "Twist across the sheet (radians)",
        component: "slider",
        min: -6.2832,
        max: 6.2832,
        step: 0.01
      },
      flip: {
        label: "Flip on handover (half-turns)",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      bob: {
        label: "Bob (fraction of a cell)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      bobScale: {
        label: "Bob scale (spatial)",
        component: "slider",
        min: 0.5,
        max: 8,
        step: 0.1
      },
      bobCycles: {
        label: "Bob cycles per loop",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      }
    }
  },

  relief: {
    component: "nested-object",
    label: "Relief",
    fields: {
      height: {
        label: "Lift with coverage (world units, 0 = flat)",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      }
    }
  },

  rhythm: rhythmFormConfiguration,
  rise: riseFormConfiguration,
  fall: fallFormConfiguration,

  material: {
    component: "nested-object",
    label: "Material",
    fields: {
      ...lookFormFields,
      fusion: {
        label: "Fusion between touching dots (fraction of a cell)",
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
            value: "swell",
            label: "Swell (dots grow under it)"
          },
          {
            value: "attract",
            label: "Attract (dots slide toward it)"
          }
        ]
      },
      ...cursorFormFields
    }
  },

  interaction: sheetInteractionFormConfiguration,
  camera: sheetCameraFormConfiguration,
  colors: colorsFormConfiguration,
  light: lightFormConfiguration,
  rendering: renderingFormConfiguration,
  backgroundColor: backgroundColorFormConfiguration
};
