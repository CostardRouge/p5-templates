import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

// v2's board, raymarched in one pass instead of baked into cards: the tiles
// are v1's tubes for real, so the specular travels as a tile turns and the
// ambient occlusion is computed where the tubes actually meet.
//
// The defining constraint, and the reason a cell shows ONE GLYPH rather than a
// word: the shader reaches a cell's capsules through a loop over the bank (GLSL
// ES 1.00 forbids indexing a uniform array by a uniform-derived index), and one
// glyph per face is what keeps that budget at v1's 8 x 48. `text.glyphs` is
// therefore a bank of characters, not a list of words. See index.js.
//
// Editing `layout`: switching a conditional group's branch REBUILDS the whole
// object from the branch's field defaults, and a field without an explicit
// `default` falls back to its `min` — so every field in both branches has one.
export const formValues = {
  timeScale: 1,

  text: {
    // One character per face; the board picks from this bank.
    glyphs: "abcd",
    font: "waverseVariable",
    detail: 1,
    spacing: 0.14,
    simplify: 0
  },

  layout: {
    mode: "subdivide" as "subdivide" | "fixed",
    depth: 5,
    rate: 1,
    schedule: "grow" as "pingPong" | "grow",
    scatter: 0.76,
    columns: undefined,
    rows: undefined
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
    order: "radial" as "all" | "columns" | "rows" | "diagonal" | "radial" | "noise" | "random",
    spread: 0.55,
    jitter: 0.2,
    frequency: 4,
    seed: 7,
    headMode: "clock" as "clock" | "manual",
    head: 0
  },

  content: {
    mode: "scatter" as "scatter" | "chorus" | "spell",
    offset: 1
  },

  cell: {
    gutter: 0.12,
    fill: 0.86,
    depth: 0
  },

  material: {
    // Glyph units, where 1 is roughly a cap height.
    tube: 0.05,
    fusion: 0.03
  },

  colors: {
    hueSpeed: 0,
    hueSpread: 1.73,
    huePhase: 2.6,
    lengthHueShift: -0.25,
    cellHueShift: 0.7,
    shimmer: 2.2,
    saturation: 0.9,
    brightness: 1.25
  },

  light: {
    azimuth: -1.1,
    elevation: 0.45,
    ambient: 0.48,
    diffuse: 0.56,
    specular: 1.52,
    specPower: 31,
    fresnelPower: 1.62,
    rimStrength: 0
  },

  camera: {
    fov: 21,
    margin: 0,
    pullBack: 1,
    azimuth: 0,
    elevation: 0,
    fog: 0
  },

  rendering: {
    resolutionScale: 0.7
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
      glyphs: {
        label: "Glyph bank (one character per face, max 8)",
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
          default: 3
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
          max: 12,
          step: 1,
          default: 4
        },
        rows: {
          label: "Rows",
          component: "slider",
          min: 1,
          max: 10,
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
    label: "Content (which glyph a cell shows)",
    fields: {
      mode: {
        label: "Mode",
        component: "select",
        options: [
          {
            label: "Scatter — each cell offset in the bank",
            value: "scatter"
          },
          {
            label: "Chorus — every cell shows the same glyph",
            value: "chorus"
          },
          {
            label: "Spell — the bank marches across the board",
            value: "spell"
          }
        ]
      },
      offset: {
        label: "Scatter spread (how far apart cells sit in the bank)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.05
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
        max: 0.9,
        step: 0.01
      },
      fill: {
        label: "Glyph size inside its tile",
        component: "slider",
        min: 0.2,
        max: 1.2,
        step: 0.01
      },
      depth: {
        label: "Depth spread (pushes cells apart in z, by rank)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  material: {
    component: "nested-object",
    label: "Material (tube)",
    fields: {
      tube: {
        label: "Tube thickness (glyph units)",
        component: "slider",
        min: 0.005,
        max: 0.2,
        step: 0.001
      },
      fusion: {
        label: "Junction fusion (smooth-union fillet)",
        component: "slider",
        min: 0.001,
        max: 0.12,
        step: 0.001
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Iridescent",
    fields: {
      hueSpeed: {
        label: "Hue scroll (snaps to whole cycles per loop)",
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
        label: "Hue drift up the board",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      cellHueShift: {
        label: "Hue shift between cells",
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
  },
  light: {
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
  rendering: {
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
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
