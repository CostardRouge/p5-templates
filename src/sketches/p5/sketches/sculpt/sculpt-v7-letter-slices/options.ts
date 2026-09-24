import {
  textFormValues,
  textFormConfiguration,
  fieldFormValues,
  fieldFormFields,
  rhythmFormValues,
  rhythmFormConfiguration,
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

// The sheet stays put; the letter moves under it, cut into strips of rows (or
// columns) that each slide by their own shift — a wave running strip by strip,
// alternating sides — so the relief that rises is the letter sliced and
// sheared. On a handover the strips scatter to one side while the next
// letter's slide in from the other.
export const formValues = {
  timeScale: 1,

  text: {
    ...textFormValues
  },

  field: {
    ...fieldFormValues,
    density: 21,
    jitter: 0.1,
    drift: 0.05,
    // Radius of a junction bead at rest (fraction of a cell; 0 = tubes only).
    bead: 0.15
  },

  slices: {
    // Strips of rows slide sideways; strips of columns slide up and down.
    axis: "columns" as "rows" | "columns",
    // Rows (or columns) per strip.
    band: 6,
    // Amplitude of each strip's wave (fraction of the sheet).
    wave: 0.045,
    // Whole cycles of the wave per loop.
    cycles: 1,
    // Phase step from one strip to the next (radians): the wave's slant.
    phase: 0.6,
    // Odd strips run the other way.
    alternate: true,
    // How far a strip slides out on a handover (fraction of the sheet).
    scatter: 0.43,
    // Which strip goes first on a handover.
    order: "first-last" as "first-last" | "last-first" | "centre-out" | "edges-in" | "alternate" | "random",
    // 0 = every strip together, 0.95 = one after the other.
    spread: 0.32,
    outEasing: "easeInCubic",
    inEasing: "easeOutBack",
    // How much a point on the ink is carried with its strip (its cell caps it).
    carry: 0.37
  },

  relief: {
    // Full elevation, world units (the sheet is 2 units tall).
    height: 0.17,
    // flat: every strip level · ramp: each strip higher than the last.
    profile: "flat" as "flat" | "ramp"
  },

  rhythm: {
    ...rhythmFormValues,
    hold: 0.45,
    // crossfade: the strips slide out and in at once · sequential: out, then in.
    transition: "crossfade" as "crossfade" | "sequential"
  },

  links: {
    reach: "4" as "4" | "8",
    rule: "ink" as "ink" | "endpoints",
    restWeight: 0.05,
    gain: 0.7,
    // Stretched links between two strips survive up to this length (cells).
    maxLength: 1.9
  },

  material: {
    ...lookFormValues,
    thickness: 0.45,
    fusion: 0.45
  },

  cursor: {
    mode: "lift" as "off" | "lift" | "press" | "attract",
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
    label: "Sheet of points",
    fields: {
      ...fieldFormFields,
      bead: {
        label: "Bead radius (fraction of a cell)",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      }
    }
  },

  slices: {
    component: "nested-object",
    label: "Slices",
    fields: {
      axis: {
        label: "Cut into",
        component: "select",
        options: [
          {
            value: "rows",
            label: "Rows (strips slide sideways)"
          },
          {
            value: "columns",
            label: "Columns (strips slide up and down)"
          }
        ]
      },
      band: {
        label: "Rows / columns per strip",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      wave: {
        label: "Wave amplitude (fraction of the sheet)",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      },
      cycles: {
        label: "Wave cycles per loop",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      },
      phase: {
        label: "Phase step per strip (radians)",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      alternate: {
        label: "Alternate directions",
        component: "checkbox"
      },
      scatter: {
        label: "Scatter on handover (fraction of the sheet)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      order: {
        label: "Handover order",
        component: "select",
        options: [
          {
            value: "first-last",
            label: "First strip first"
          },
          {
            value: "last-first",
            label: "Last strip first"
          },
          {
            value: "centre-out",
            label: "Centre out"
          },
          {
            value: "edges-in",
            label: "Edges in"
          },
          {
            value: "alternate",
            label: "Even strips, then odd"
          },
          {
            value: "random",
            label: "Random"
          }
        ]
      },
      spread: {
        label: "Spread (0 = together, 0.95 = one by one)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      outEasing: {
        label: "Easing out",
        component: "easing"
      },
      inEasing: {
        label: "Easing in",
        component: "easing"
      },
      carry: {
        label: "Carry the points with their strip",
        component: "slider",
        min: 0,
        max: 1,
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
      profile: {
        label: "Profile",
        component: "select",
        options: [
          {
            value: "flat",
            label: "Flat"
          },
          {
            value: "ramp",
            label: "Ramp (a staircase of strips)"
          }
        ]
      }
    }
  },

  rhythm: {
    ...rhythmFormConfiguration,
    fields: {
      ...rhythmFormConfiguration.fields,
      transition: {
        label: "Handover",
        component: "select",
        options: [
          {
            value: "crossfade",
            label: "Crossfade (out and in at once)"
          },
          {
            value: "sequential",
            label: "Sequential (out, then in)"
          }
        ]
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
    label: "Material",
    fields: {
      ...lookFormFields,
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
