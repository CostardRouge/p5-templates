import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

// A cycle of letters or words changed by the turn itself: the plane holding
// the text rotates about a horizontal or a vertical axis, and every time it
// passes edge-on to the camera — where the glyph is a hairline and there is
// nothing to see — the next entry takes over. One beat = one entry = a half
// turn, `flip.cycles` whole passes through the list per loop, so frame 0 wraps
// exactly. See index.js for the beat's shape and why the plane restarts at
// -90° rather than continuing to 180° (the back of a glyph is its mirror),
// and ../_shared.js for the beat shape the whole category runs on.
export const formValues = {
  timeScale: 1,

  text: {
    words: [
      "a",
      "b",
      "c"
    ] as string[],
    font: "waverseVariable",
    detail: 0.81,
    spacing: 0.095,
    simplify: 0
  },

  flip: {
    // Which way the plane turns. Only x and y ever bring it edge-on to the
    // camera — a z (in-plane) spin never flattens anything, so it is not a
    // flip axis and is not offered here.
    axis: "y" as "y" | "x" | "alternate",
    // "camera": the plane rests facing the camera, so edge-on is exact
    // whatever the camera is doing. "world": rings-v3's fixed plane, tilted by
    // the camera's elevation and orbit.
    frame: "world" as "camera" | "world",
    // "letter": every glyph turns in place on its own axis (what makes the
    // stagger a split-flap cascade). "word": the whole plane turns as one.
    pivot: "letter" as "letter" | "word",
    cycles: 4,
    // Fraction of each beat the entry is held face-on and legible, before and
    // after being turned into the next one. 0 = a constant spin.
    hold: 0.05,
    easing: "linear",
    direction: "forward" as "forward" | "backward",
    // Fraction of a beat the cascade spans: glyph k starts its turn that much
    // later than glyph 0. Ignored when the pivot is the word.
    stagger: 0
  },

  material: {
    size: 2.45,
    thickness: 0.02,
    fusion: 0.215
  },

  camera: {
    fov: 59,
    // Ignored while auto-fit is on — it frames each entry instead, easing from
    // one entry's distance to the next's while the plane is still edge-on.
    distance: 4.4,
    autoFit: {
      enabled: false,
      margin: 0.2,
      easing: "easeInOutCubic"
    },
    orbit: 0,
    phase: 0,
    elevation: 0.05,
    bob: 0,
    bobCycles: 1,
    motion: "flow" as "flow" | "ease",
    easing: "easeInOutCubic",
    glide: 0.48,
    fogDensity: 0
  },

  colors: {
    hueSpeed: 1,
    hueSpread: 1.73,
    huePhase: 2.6,
    lengthHueShift: -0.25,
    pipeHueShift: 0.7,
    shimmer: 3,
    saturation: 1,
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
    rimStrength: 0,
    shadowSoftness: 0
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
      words: {
        label: "Cycle (one beat each — letter or word, max 8 letters)",
        component: "item-list",
        minItems: 1,
        maxItems: 8,
        itemConfig: {
          label: "Text",
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
        max: 0.12,
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
  flip: {
    component: "nested-object",
    label: "Flip (the letter change)",
    fields: {
      axis: {
        label: "Flip axis",
        component: "select",
        options: [
          {
            label: "Y — vertical axis (swings left ↔ right)",
            value: "y"
          },
          {
            label: "X — horizontal axis (tumbles top ↔ bottom)",
            value: "x"
          },
          {
            label: "Alternate X and Y on every change",
            value: "alternate"
          }
        ]
      },
      frame: {
        label: "Flat against…",
        component: "select",
        options: [
          {
            label: "The camera (edge-on is exact, whatever the camera does)",
            value: "camera"
          },
          {
            label: "The world axes (the camera's elevation tilts the text)",
            value: "world"
          }
        ]
      },
      pivot: {
        label: "What turns",
        component: "select",
        options: [
          {
            label: "Each letter, in place (split-flap — stagger works here)",
            value: "letter"
          },
          {
            label: "The whole word, as one plane",
            value: "word"
          }
        ]
      },
      cycles: {
        label: "Passes through the list per loop",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      },
      hold: {
        label: "Hold face-on (0 = constant spin, 1 = mostly still)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      easing: {
        label: "Turn easing",
        component: "easing"
      },
      direction: {
        label: "Turn direction",
        component: "select",
        options: [
          {
            label: "Forward",
            value: "forward"
          },
          {
            label: "Backward",
            value: "backward"
          }
        ]
      },
      stagger: {
        label: "Letter stagger (cascade across the word, per-letter pivot)",
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
      size: {
        label: "Letter size (world)",
        component: "slider",
        min: 0.5,
        max: 4,
        step: 0.05
      },
      thickness: {
        label: "Tube thickness",
        component: "slider",
        min: 0.005,
        max: 0.35,
        step: 0.005
      },
      fusion: {
        label: "Junction fusion (smooth-union fillet)",
        component: "slider",
        min: 0.001,
        max: 0.25,
        step: 0.001
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      fov: {
        label: "Field of view °",
        component: "slider",
        min: 30,
        max: 110,
        step: 1
      },
      distance: {
        label: "Distance from the text (auto-fit off)",
        component: "slider",
        min: 0.5,
        max: 12,
        step: 0.05
      },
      autoFit: {
        component: "nested-object",
        label: "Auto-fit (frame every entry)",
        fields: {
          enabled: {
            label: "Frame each entry automatically?",
            component: "checkbox"
          },
          margin: {
            label: "Margin around the text",
            component: "slider",
            min: 0,
            max: 1.5,
            step: 0.01
          },
          easing: {
            label: "Zoom easing between entries",
            component: "easing"
          }
        }
      },
      orbit: {
        label: "Orbit turns per loop (0 = static camera)",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      },
      phase: {
        label: "Start angle (static viewpoint when orbit = 0)",
        component: "slider",
        min: 0,
        max: 6.2832,
        step: 0.01
      },
      elevation: {
        label: "Elevation (look down ↔ up at the text)",
        component: "slider",
        min: -1.4,
        max: 1.4,
        step: 0.01
      },
      bob: {
        label: "Vertical bob amplitude",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      bobCycles: {
        label: "Vertical bob cycles per loop",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      motion: {
        label: "Orbit motion",
        component: "select",
        options: [
          {
            label: "Flow (constant glide)",
            value: "flow"
          },
          {
            label: "Ease into each viewpoint (one stop per turn)",
            value: "ease"
          }
        ]
      },
      easing: {
        label: "Approach easing (Ease mode)",
        component: "easing"
      },
      glide: {
        label: "Glide (Ease mode: 0 = constant speed, 1 = dwell at each stop)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      fogDensity: {
        label: "Fog (fades the far side of the turn into the background)",
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
      hueSpeed: {
        label: "Hue speed (snaps to whole cycles/loop)",
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
        label: "Depth hue shift",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      pipeHueShift: {
        label: "Letter hue shift",
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
      },
      shadowSoftness: {
        label: "Letter shadows (0 = off, higher = harder)",
        component: "slider",
        min: 0,
        max: 64,
        step: 1
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
