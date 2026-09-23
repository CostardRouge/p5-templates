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

// The letter is a stone dropped in the sheet: rings of raised, thickened tubes
// travel out from the glyph (or in to it) through the mesh, pushing the points
// as they pass, while the ink holds as a plateau. Each beat the stone changes
// shape and the rings bend from one outline to the next.
export const formValues = {
  timeScale: 1,

  text: {
    ...textFormValues,
    // Smaller than the family's default: the rings need room around the glyph.
    size: 0.6
  },

  field: {
    ...fieldFormValues,
    density: 44,
    jitter: 0.1,
    drift: 0.04,
    // Radius of a junction bead at rest (fraction of a cell; 0 = tubes only).
    bead: 0.14
  },

  ripple: {
    // Rings per loop (whole, so the loop closes).
    rings: 2,
    // Distance between two crests (cells).
    spacing: 6,
    // How far from the ink the rings are felt (cells).
    reach: 16,
    // The crest's share of its period (0.05 a thin ring, 1 a full sine).
    width: 0.55,
    // Height of a crest at the ink (world units), fading over the reach.
    height: 0.3,
    // Fade with distance: (1 − d / reach) ^ decay.
    decay: 1,
    direction: "out" as "out" | "in",
    // How far a crest pushes the points along its way (cells, up to 0.45).
    push: 0.3,
    // Rings keep their phase across the plateau, so a counter ripples too.
    through: true,
    // Easing of the blend from one letter's distance field to the next.
    blendEasing: "easeInOutSine"
  },

  relief: {
    // Height of the ink's plateau (world units).
    height: 0.22
  },

  rhythm: {
    ...rhythmFormValues
  },

  rise: {
    ...riseFormValues,
    order: "radial-out",
    spread: 0.5
  },

  fall: {
    ...fallFormValues,
    spread: 0.5
  },

  links: {
    reach: "4" as "4" | "8",
    // endpoints by default: a ring crosses a counter, the ink rule would cut it.
    rule: "endpoints" as "ink" | "endpoints",
    // A faint rest mesh: the rings are tubes, the sheet between them is dots.
    restWeight: 0.06,
    gain: 0.6,
    maxLength: 1.9,
    // A link climbing more than this (world units) is dropped: without it
    // every crest hangs a skirt of hairlines down to the sheet.
    maxRise: 0.1
  },

  material: {
    ...lookFormValues,
    thickness: 0.4,
    fusion: 0.45
  },

  cursor: {
    // off · source: rings radiate from the pointer too · lift / press.
    mode: "source" as "off" | "source" | "lift" | "press",
    ...cursorFormValues,
    radius: 0.3
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

  ripple: {
    component: "nested-object",
    label: "Ripple",
    fields: {
      rings: {
        label: "Rings per loop",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      spacing: {
        label: "Spacing between crests (cells)",
        component: "slider",
        min: 1,
        max: 20,
        step: 0.5
      },
      reach: {
        label: "Reach (cells from the ink)",
        component: "slider",
        min: 1,
        max: 40,
        step: 0.5
      },
      width: {
        label: "Crest width (share of the period)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      height: {
        label: "Crest height (world units)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      decay: {
        label: "Fade with distance (power)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.05
      },
      direction: {
        label: "Direction",
        component: "select",
        options: [
          {
            value: "out",
            label: "Out, away from the letter"
          },
          {
            value: "in",
            label: "In, toward the letter"
          }
        ]
      },
      push: {
        label: "Push along the crest (cells)",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.01
      },
      through: {
        label: "Rings continue through the ink",
        component: "checkbox"
      },
      blendEasing: {
        label: "Blend between letters",
        component: "easing"
      }
    }
  },

  relief: {
    component: "nested-object",
    label: "Relief",
    fields: {
      height: {
        label: "Plateau height (world units)",
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
            value: "endpoints",
            label: "Two raised ends suffice"
          },
          {
            value: "ink",
            label: "Midpoint must be on the ink"
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
      },
      maxRise: {
        label: "Max link climb (world units; 2 = keep the skirt)",
        component: "slider",
        min: 0.02,
        max: 2,
        step: 0.01
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
            value: "source",
            label: "Source (rings radiate from it)"
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
