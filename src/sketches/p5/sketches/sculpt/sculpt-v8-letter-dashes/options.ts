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

// One dash per cell, lying on the sheet. On the ink a dash turns to lie along
// the stroke, grows and fuses with its neighbours into a ribbon; off it the
// dashes are short needles in a rest field. Each beat the dashes swing round
// to the next character's strokes, shortening as they turn.
export const formValues = {
  timeScale: 1,

  text: {
    ...textFormValues
  },

  field: {
    ...fieldFormValues,
    density: 34,
    jitter: 0,
    drift: 0
  },

  dashes: {
    shape: "capsule" as "capsule" | "bar",
    // Half-length on the ink (cells): near 1 the dashes along a stroke touch.
    length: 0.9,
    // Half-length off the ink (cells).
    restLength: 0.28,
    // Radius gained on the ink and radius off it (fractions of a cell).
    radius: 0.16,
    restRadius: 0.06,
    // Bar corner rounding (fraction of the radius).
    rounding: 0.4,
    // How far from the ink a dash still aligns with the nearest stroke (cells).
    reach: 1.5,
    // The rest field: flat (one angle) · radial (toward the centre) · rings
    // (around it) · noise.
    rest: "flat" as "flat" | "radial" | "rings" | "noise",
    restAngle: 0,
    restScale: 2,
    // Whole half-turns per loop of the rest field (a dash is the same turned by π).
    spin: 0,
    // Flourish past the target angle mid-swing (radians).
    swing: 0.6
  },

  relief: {
    // Lift of the dashes on the ink (world units, 0 = flat).
    height: 0
  },

  rhythm: {
    ...rhythmFormValues,
    hold: 0.45
  },

  rise: {
    ...riseFormValues,
    order: "reading",
    spread: 0.6,
    easing: "easeOutCubic"
  },

  fall: {
    ...fallFormValues,
    spread: 0.6,
    easing: "easeInOutCubic"
  },

  squeeze: {
    // How much the dashes shorten and thin while they swing (0 = none).
    amount: 0.5,
    // How far past their size they pop as they land (0 = none).
    overshoot: 0.15
  },

  material: {
    ...lookFormValues,
    // Smooth-union fillet between touching dashes (fraction of a cell).
    fusion: 0.4
  },

  cursor: {
    // off · compass: dashes within reach point at it · attract: they slide toward it.
    mode: "compass" as "off" | "compass" | "attract",
    ...cursorFormValues,
    radius: 0.25,
    strength: 0.8
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
    label: "Grid of dashes",
    fields: fieldFormFields
  },

  dashes: {
    component: "nested-object",
    label: "Dashes",
    fields: {
      shape: {
        label: "Shape",
        component: "select",
        options: [
          {
            value: "capsule",
            label: "Capsule"
          },
          {
            value: "bar",
            label: "Bar (rounded box)"
          }
        ]
      },
      length: {
        label: "Half-length on the ink (cells)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      restLength: {
        label: "Half-length off the ink (cells)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      radius: {
        label: "Radius gained on the ink (fraction of a cell)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      restRadius: {
        label: "Radius off the ink (fraction of a cell)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      rounding: {
        label: "Bar rounding",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      reach: {
        label: "Alignment reach (cells from the ink)",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.1
      },
      rest: {
        label: "Rest field",
        component: "select",
        options: [
          {
            value: "flat",
            label: "Flat (one angle)"
          },
          {
            value: "radial",
            label: "Radial (toward the centre)"
          },
          {
            value: "rings",
            label: "Rings (around the centre)"
          },
          {
            value: "noise",
            label: "Noise"
          }
        ]
      },
      restAngle: {
        label: "Rest angle (radians)",
        component: "slider",
        min: 0,
        max: 3.1416,
        step: 0.01
      },
      restScale: {
        label: "Noise scale",
        component: "slider",
        min: 0.5,
        max: 8,
        step: 0.1
      },
      spin: {
        label: "Rest spin (half-turns per loop)",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      },
      swing: {
        label: "Swing past the target (radians)",
        component: "slider",
        min: 0,
        max: 3.1416,
        step: 0.01
      }
    }
  },

  relief: {
    component: "nested-object",
    label: "Relief",
    fields: {
      height: {
        label: "Lift on the ink (world units, 0 = flat)",
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

  squeeze: {
    component: "nested-object",
    label: "Squeeze (through the swing)",
    fields: {
      amount: {
        label: "Amount (shortening mid-swing)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      overshoot: {
        label: "Overshoot (pop past the size)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },

  material: {
    component: "nested-object",
    label: "Material",
    fields: {
      ...lookFormFields,
      fusion: {
        label: "Fusion between touching dashes (fraction of a cell)",
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
            value: "compass",
            label: "Compass (dashes point at it)"
          },
          {
            value: "attract",
            label: "Attract (dashes slide toward it)"
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
