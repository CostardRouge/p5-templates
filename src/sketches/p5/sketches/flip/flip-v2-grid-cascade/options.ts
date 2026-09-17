import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

// A board of turning tiles where the turn is also what multiplies them: a tile
// goes edge-on and comes back as two, then four, then eight. See index.js for
// why the tree is rebuilt every frame (it has to be a pure function of the
// clock to be capturable) and ../_shared.js for the beat every sketch in this
// category runs on.
//
// One trap worth knowing before editing `layout`: switching a conditional
// group's branch REBUILDS the whole object from the branch's field defaults,
// and a field without an explicit `default` falls back to its `min` (see
// ConditionalGroup.getDefaultValueForFieldConfig). Every field inside the two
// branches below therefore carries one.
export const formValues = {
  timeScale: 1,

  text: {
    words: [
      "1",
      "2",
      "3",
      "4"
    ] as string[],
    font: "spaceMonoItalic",
    detail: 0.92,
    spacing: 0.02,
    simplify: 0
  },

  // What goes on a card. Both renderers draw the same geometry — only the
  // material differs — but they measure the tube against different things, so
  // the thickness lives in the branch rather than above it.
  //
  // `strokes` is the default since v3 exists: v3 raymarches the whole board,
  // so its tubes are lit for real rather than lit face-on and painted on.
  // The shader card stays here because it costs a bake instead of a march,
  // which is what a board deeper than v3's ceiling needs.
  card: {
    renderer: "strokes" as "shader" | "strokes",
    // Strokes: fraction of the card's side. This is the tuned value that used
    // to live on `text.thickness`; the group moved, the number did not.
    thickness: 0.035,
    // Shader: glyph units, where 1 is roughly a cap height (v1's ratio of
    // material.thickness to material.size is ~0.008; this reads thicker
    // because a grid cell is small on screen).
    tube: 0.045,
    fusion: 0.02
  },

  layout: {
    // "subdivide" — the cascade, owned by the sketch because a split has to
    // land on a flat frame. "fixed" — a plain board, two numbers you can drive
    // from anywhere because nothing about them has to.
    mode: "subdivide" as "subdivide" | "fixed",
    depth: 6,
    rate: 2,
    schedule: "grow" as "pingPong" | "grow",
    scatter: 0,
    columns: 8,
    rows: 5
  },

  flip: {
    cycles: 1,
    hold: 0.15,
    easing: "easeInOutCubic",
    overshoot: 0.4,
    axis: "follow" as "follow" | "y" | "x" | "checker" | "random",
    counterSpin: 0.2,
    rogue: 0.06
  },

  wave: {
    order: "columns" as "all" | "columns" | "rows" | "diagonal" | "radial" | "noise" | "random",
    spread: 0.55,
    jitter: 0.46,
    frequency: 4,
    seed: 350,
    // "manual" hands the front over: `head` then replaces the loop clock
    // outright, so an interaction binding drives the whole board.
    headMode: "clock" as "clock" | "manual",
    head: 0.29
  },

  content: {
    mode: "scatter" as "scatter" | "chorus" | "spell",
    offset: 1.7,
    // Every cell samples its own rectangle of ONE face spanning the board, so
    // subdividing cuts the glyph into pieces instead of replacing it.
    inherit: false
  },

  cell: {
    gutter: 0.23,
    fill: 0.65,
    depth: 0.29,
    trail: 0.37
  },

  colors: {
    huePhase: 161,
    hueSpread: 0.6,
    faceHueShift: 55,
    cellHueShift: 60,
    tintPhase: 215,
    hueSpeed: 1,
    saturation: 55,
    brightness: 1,
    // Shader card only: the hue drift up the glyph, and between the letters
    // of one entry.
    lengthHueShift: -0.25,
    letterHueShift: 0.7,
    shimmer: 2.2
  },

  // Shader card only — the strokes renderer has no lighting model.
  light: {
    azimuth: -1.1,
    elevation: 0.45,
    ambient: 0.48,
    diffuse: 0.56,
    specular: 1.52,
    specPower: 31,
    fresnelPower: 1.62,
    rimStrength: 0,
    shadowSoftness: 0
  },

  camera: {
    fov: 45,
    margin: 0.08,
    pullBack: 1,
    azimuth: 0,
    elevation: 0.12,
    fog: 0.25
  },

  backgroundColor: [
    0,
    0,
    0
  ]
};

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
      words: {
        label: "Faces (one per beat — a letter or a word)",
        component: "item-list",
        minItems: 1,
        maxItems: 12,
        itemConfig: {
          label: "Face",
          component: "text"
        }
      },
      font: {
        label: "Font",
        component: "select",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      detail: {
        label: "Outline detail (sample factor)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      spacing: {
        label: "Capsule spacing (lower = denser)",
        component: "slider",
        min: 0.02,
        max: 0.14,
        step: 0.005
      },
      simplify: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      }
    }
  },
  card: {
    component: "conditional-group",
    label: "Card (what a tile is made of)",
    conditionalOn: "renderer",
    typeSelector: {
      label: "Material",
      options: [
        {
          label: "Shader — v1's raymarched tubes",
          value: "shader"
        },
        {
          label: "Strokes — flat capsule chain",
          value: "strokes"
        }
      ]
    },
    configs: {
      shader: {
        tube: {
          label: "Tube thickness (glyph units)",
          component: "slider",
          min: 0.005,
          max: 0.2,
          step: 0.001,
          default: 0.045
        },
        fusion: {
          label: "Junction fusion (smooth-union fillet)",
          component: "slider",
          min: 0.001,
          max: 0.12,
          step: 0.001,
          default: 0.02
        }
      },
      strokes: {
        thickness: {
          label: "Stroke thickness (fraction of the card)",
          component: "slider",
          min: 0.005,
          max: 0.2,
          step: 0.005,
          default: 0.035
        }
      }
    }
  },
  layout: {
    component: "conditional-group",
    label: "Layout (how many cells)",
    conditionalOn: "mode",
    typeSelector: {
      label: "Board",
      options: [
        {
          label: "Subdivision cascade",
          value: "subdivide"
        },
        {
          label: "Fixed grid",
          value: "fixed"
        }
      ]
    },
    configs: {
      subdivide: {
        depth: {
          label: "Max generation (0 = 1 tile, 3 = 8, 6 = 64)",
          component: "slider",
          min: 0,
          max: 6,
          step: 1,
          default: 4
        },
        rate: {
          label: "Beats per generation",
          component: "slider",
          min: 1,
          max: 4,
          step: 1,
          default: 1
        },
        schedule: {
          label: "Schedule",
          component: "select",
          default: "pingPong",
          options: [
            {
              label: "Ping-pong — it multiplies, then collapses back",
              value: "pingPong"
            },
            {
              label: "Grow — it multiplies, then starts over at one",
              value: "grow"
            }
          ]
        },
        scatter: {
          label: "Scatter (0 = a clean power of two, 1 = a ragged quadtree)",
          component: "slider",
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.35
        }
      },
      fixed: {
        columns: {
          label: "Columns",
          component: "slider",
          min: 1,
          max: 16,
          step: 1,
          default: 4
        },
        rows: {
          label: "Rows",
          component: "slider",
          min: 1,
          max: 12,
          step: 1,
          default: 3
        }
      }
    }
  },
  flip: {
    component: "nested-object",
    label: "Flip (the turn itself)",
    fields: {
      cycles: {
        label: "Passes per loop (the whole schedule, start to start)",
        component: "slider",
        min: 1,
        max: 4,
        step: 1
      },
      hold: {
        label: "Hold face-on (0 = constant spin)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      easing: {
        label: "Turn easing",
        component: "easing"
      },
      overshoot: {
        label: "Overshoot (the mechanical snap on landing)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      axis: {
        label: "Turn axis",
        component: "select",
        options: [
          {
            label: "Follow the cut (a tile turns about the axis it was split on)",
            value: "follow"
          },
          {
            label: "Y — every tile swings left ↔ right",
            value: "y"
          },
          {
            label: "X — every tile tumbles top ↔ bottom",
            value: "x"
          },
          {
            label: "Checker — alternating, like a chessboard",
            value: "checker"
          },
          {
            label: "Random per cell",
            value: "random"
          }
        ]
      },
      counterSpin: {
        label: "Counter-spin (share of cells turning the other way)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      rogue: {
        label: "Rogue cells (they ignore their turn and run at double speed)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      }
    }
  },
  wave: {
    component: "nested-object",
    label: "Wavefront (who turns, and when)",
    fields: {
      order: {
        label: "Order",
        component: "select",
        options: [
          {
            label: "Radial — a bloom from the centre",
            value: "radial"
          },
          {
            label: "Columns — a curtain, left to right",
            value: "columns"
          },
          {
            label: "Rows — a curtain, top to bottom",
            value: "rows"
          },
          {
            label: "Diagonal",
            value: "diagonal"
          },
          {
            label: "Noise — blobs of cells turning together",
            value: "noise"
          },
          {
            label: "Random — sparkle",
            value: "random"
          },
          {
            label: "All together",
            value: "all"
          }
        ]
      },
      spread: {
        label: "Spread (0 = everyone at once, 1 = a full sweep per beat)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      jitter: {
        label: "Jitter (0 = a clean sweep, 1 = pure disorder)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      frequency: {
        label: "Noise frequency (Noise order only)",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      seed: {
        label: "Seed (every random choice in the sketch goes through it)",
        component: "slider",
        min: 0,
        max: 999,
        step: 1
      },
      headMode: {
        label: "What drives the front",
        component: "select",
        options: [
          {
            label: "The loop clock",
            value: "clock"
          },
          {
            label: "The Head slider below — bind it to scrub the board by hand",
            value: "manual"
          }
        ]
      },
      head: {
        label: "Head — the front's position, 0 → 1 (manual mode)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.001
      }
    }
  },
  content: {
    component: "nested-object",
    label: "Content (what a cell shows)",
    fields: {
      mode: {
        label: "Mode",
        component: "select",
        options: [
          {
            label: "Scatter — each cell offset in the cycle",
            value: "scatter"
          },
          {
            label: "Chorus — every cell shows the same face",
            value: "chorus"
          },
          {
            label: "Spell — the faces march across the board",
            value: "spell"
          }
        ]
      },
      offset: {
        label: "Scatter spread (how far apart cells sit in the cycle)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.05
      },
      inherit: {
        label: "Fragment instead of replace (one face cut across the board)",
        component: "checkbox"
      }
    }
  },
  cell: {
    component: "nested-object",
    label: "Cell",
    fields: {
      gutter: {
        label: "Gutter between tiles",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      fill: {
        label: "Glyph size inside its tile",
        component: "slider",
        min: 0.2,
        max: 1.1,
        step: 0.01
      },
      depth: {
        label: "Depth spread (pushes cells apart in z, by rank)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      trail: {
        label: "Afterglow (a cell stays hot just after it turns)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Iridescent",
    fields: {
      huePhase: {
        label: "Base hue °",
        component: "slider",
        min: 0,
        max: 360,
        step: 1
      },
      hueSpread: {
        label: "Hue travel across the glyph",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.01
      },
      faceHueShift: {
        label: "Hue shift between faces °",
        component: "slider",
        min: 0,
        max: 180,
        step: 1
      },
      cellHueShift: {
        label: "Hue shift across the board ° (0 = one colour everywhere)",
        component: "slider",
        min: 0,
        max: 180,
        step: 1
      },
      tintPhase: {
        label: "Board hue phase °",
        component: "slider",
        min: 0,
        max: 360,
        step: 1
      },
      hueSpeed: {
        label: "Hue scroll (whole cycles per loop)",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      },
      saturation: {
        label: "Saturation",
        component: "slider",
        min: 0,
        max: 100,
        step: 1
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      lengthHueShift: {
        label: "Hue drift up the glyph (shader card)",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      letterHueShift: {
        label: "Hue shift between letters of one entry (shader card)",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      shimmer: {
        label: "Shimmer — oil-slick (shader card)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      }
    }
  },
  light: {
    component: "nested-object",
    label: "Lighting (shader card only)",
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
      },
      shadowSoftness: {
        label: "Cast shadows between letters (0 = off)",
        component: "slider",
        min: 0,
        max: 64,
        step: 1
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      fov: {
        label: "Field of view ° (low = flat board, high = deep perspective)",
        component: "slider",
        min: 15,
        max: 100,
        step: 1
      },
      margin: {
        label: "Margin around the board",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      pullBack: {
        label: "Pull back (1 = the board fills the frame)",
        component: "slider",
        min: 0.5,
        max: 3,
        step: 0.01
      },
      azimuth: {
        label: "Azimuth (look from the side)",
        component: "slider",
        min: -1.2,
        max: 1.2,
        step: 0.01
      },
      elevation: {
        label: "Elevation (look from above or below)",
        component: "slider",
        min: -1.2,
        max: 1.2,
        step: 0.01
      },
      fog: {
        label: "Fog (fades cells pushed back by the depth spread)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
