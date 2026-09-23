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

// A sheet of points joined by thin tubes covers the canvas; a letter pulls the
// sheet IN — every point within reach slides toward the ink, the mesh
// contracts onto the glyph and its tubes thicken and fuse, and everything off
// the letter stays at its rest spacing. Each beat the points slide on to the
// next character while the material squeezes and pops back.
export const formValues = {
  timeScale: 1,

  text: {
    ...textFormValues
  },

  field: {
    ...fieldFormValues,
    density: 40,
    jitter: 0.1,
    drift: 0.05,
    // Radius of a junction bead at rest (fraction of a cell; 0 = tubes only).
    bead: 0.12
  },

  pinch: {
    // How far a point may slide toward the ink (cells, up to 0.45 — a point
    // never leaves its own cell, which is what keeps the trace exact).
    pull: 0.45,
    // How far from the ink the pull is felt (cells).
    reach: 2.5,
    // Share of the pull applied INSIDE the ink, toward the stroke's axis.
    inside: 1,
    // Easing of the pull from the outline (1) to the reach (0).
    falloff: "easeInOutSine"
  },

  relief: {
    // The letter is the contraction, not a lift: 0 keeps the sheet flat.
    // Any height lifts the ink as v2 does, on top of the pinch.
    height: 0
  },

  rhythm: {
    ...rhythmFormValues
  },

  rise: {
    ...riseFormValues,
    order: "radial-out",
    spread: 0.5,
    easing: "easeOutBack"
  },

  fall: {
    ...fallFormValues,
    spread: 0.5,
    easing: "easeInOutCubic"
  },

  squeeze: {
    // How much every radius shrinks at the middle of a handover (0 = none).
    amount: 0.6,
    // How far past its size the material pops in the second half (0 = none).
    overshoot: 0.25
  },

  links: {
    // 4: orthogonal neighbours · 8: diagonals too.
    reach: "8" as "4" | "8",
    // ink: a link between raised points needs its midpoint on the ink ·
    // endpoints: two raised ends suffice.
    rule: "ink" as "ink" | "endpoints",
    // Tube radius at rest, as a fraction of the material thickness: the rest
    // mesh stays visible, so the contraction has something to read against.
    restWeight: 0.35,
    // Radius gained per unit of link weight (the lower of the two ends): kept
    // low so the tubes on the ink stay tubes and the letter is the density.
    gain: 0.3,
    // A link stretched past this many cells (pinch, cursor) is dropped.
    maxLength: 1.9
  },

  material: {
    ...lookFormValues,
    // Reference tube radius, as a fraction of a cell.
    thickness: 0.35,
    // Smooth-union fillet where tubes meet (fraction of a cell): what makes
    // contracted tubes fuse — past ~0.45 the letter melts into a slab.
    fusion: 0.3
  },

  cursor: {
    // off · attract: the sheet sticks to the pointer and the tubes stretch
    // after it · lift / press: a finger under / on the sheet.
    mode: "attract" as "off" | "lift" | "press" | "attract",
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

  pinch: {
    component: "nested-object",
    label: "Pinch (the sheet contracts onto the ink)",
    fields: {
      pull: {
        label: "Pull (cells a point may slide)",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.01
      },
      reach: {
        label: "Reach (cells from the ink)",
        component: "slider",
        min: 0.5,
        max: 8,
        step: 0.1
      },
      inside: {
        label: "Inside the ink (toward the stroke's axis)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      falloff: {
        label: "Falloff from the outline",
        component: "easing"
      }
    }
  },

  relief: {
    component: "nested-object",
    label: "Relief",
    fields: {
      height: {
        label: "Height (world units, 0 = flat)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      }
    }
  },

  rhythm: rhythmFormConfiguration,
  rise: riseFormConfiguration,
  fall: fallFormConfiguration,

  squeeze: {
    component: "nested-object",
    label: "Squeeze (through the handover)",
    fields: {
      amount: {
        label: "Amount (radius dip at mid-handover)",
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
        label: "Thickening on the ink",
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
            value: "attract",
            label: "Attract (the sheet sticks to it)"
          },
          {
            value: "lift",
            label: "Lift (a finger under the sheet)"
          },
          {
            value: "press",
            label: "Press (push the sheet down)"
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
