import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";
import {
  cameraFormValues,
  cameraFormConfiguration
} from "@/p5/utils/cameraRig.js";

// v1's scatter lattice with a SKIN: a share of the points sits exactly on the
// sphere (a Fibonacci spiral), the rest is thrown inside, and the links cross
// the volume between the two — so a wave passing through shows the sphere's
// inside. The camera is the shared rig (tilt, spin, distance, an eye offset
// and a target as bindable sliders, `fit` per export aspect), the growing tip
// of a tube tapers, and the wave, the drift, the cursor wells and the material
// are v1's (../_lattice.js, ../_wave.js).
export const formValues = {
  points: {
    placement: "both" as "surface" | "volume" | "both",
    // Share of the points on the skin (both mode).
    skin: 0.5,
    count: 56,
    seed: 7,
    // Evenness: the volume's spacing floor, and the skin's spiral order
    // (1 = the bare spiral, 0 = a seeded scatter on the sphere).
    spacing: 0.6,
    // World radius of the sphere.
    radius: 1.5
  },

  links: {
    neighbours: 2,
    // Longest link allowed, as a fraction of the radius.
    reach: 0.8,
    // Seeded probability of keeping each link.
    density: 1
  },

  wave: {
    mode: "radial-out" as "radial-out" | "radial-in" | "left-right" | "right-left" | "top-down" | "bottom-up" | "front-back" | "back-front" | "diagonal" | "noise" | "random" | "cursor",
    effect: "grow" as "grow-swell" | "grow" | "swell" | "reveal" | "none",
    // Waves per loop (whole numbers, so the capture closes).
    count: 1,
    // How staggered the front is across the sculpture: 0 = everything at
    // once, 1 = the front takes one whole wave to cross it.
    spread: 1,
    // Pose and hold, as fractions of a link's cycle; the withdraw lasts as
    // long as the pose. The hold is shortened first if the three overflow.
    rise: 0.3,
    hold: 0.1,
    // Radius gain at the crest (× 1 + swell), swell effects only.
    swell: 0.4,
    easing: "smoothstep",
    // Seeded noise on the rank — breaks the regularity of the front.
    jitter: 0,
    // Spatial frequency of the `noise` mode.
    frequency: 1.5,
    // "manual" hands the front over: `head` then replaces the loop clock
    // outright, so an interaction binding scrubs the wave by hand.
    headMode: "clock" as "clock" | "manual",
    head: 0
  },

  motion: {
    // Drift of the points (fraction of the radius), sampled from a seeded
    // value noise on a circle so whole cycles close the loop.
    drift: 0.05,
    driftCycles: 1,
    driftScale: 1.2,
    // The whole sphere's radius breathes (amplitude, whole cycles per loop).
    breathe: 0,
    breatheCycles: 1,
    // Whole turns of the sculpture about y per loop.
    spin: 0
  },

  cursor: {
    pull: "attract" as "attract" | "repel" | "none",
    // Reach of a well and the largest displacement it may cause, both as
    // fractions of the canvas's shorter side.
    range: 0.3,
    strength: 0.12,
    // Chase speed: slow settles like jelly, the top of the range snaps.
    speed: 4,
    falloff: "smoothstep",
    // A scripted, stateless cursor for exports and for the `cursor` wave mode
    // without a mouse.
    virtual: "none" as "none" | "circle" | "lissajous" | "sweep",
    virtualCycles: 1,
    virtualRadius: 0.6,
    showCursor: true
  },

  // Mouse + touch drive the pull; camera hands are wired but start OFF (flip
  // Vision → Enabled and Hands → Enabled to let fingertips tug the sphere).
  interaction: {
    ...interactionFormValues,
    mouse: {
      ...interactionFormValues.mouse,
      enabled: true
    },
    touch: {
      ...interactionFormValues.touch,
      enabled: true
    },
    vision: {
      ...interactionFormValues.vision,
      hands: {
        ...interactionFormValues.vision.hands,
        enabled: false,
        maxHands: 2,
        landmarks: {
          fingertips: true,
          palm: false
        }
      }
    },
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false
    },
    visualization: {
      ...interactionFormValues.visualization,
      enabled: false
    }
  },

  material: {
    // tube: the lit material · fringe: only the rainbow bands every tube
    // carries at its silhouette — the artefact, kept on purpose.
    look: "tube" as "tube" | "fringe",
    fringeWidth: 1,
    fringeGlow: 3,
    fringeBody: 0.1,
    thickness: 0.05,
    // Seeded spread of thickness between links.
    variation: 0.2,
    fusion: 0.08,
    // Bead at every point, as a multiple of the thickness (0 = none).
    nodes: 0.8,
    // Thinning of a tube's growing tip (0 = a plain capsule).
    taper: 0.5
  },

  // The shared rig: a low tilt and a quarter spin so the skin and the inside
  // both read, fitted on the sphere's reach with a little air around it.
  camera: {
    ...cameraFormValues,
    fit: true,
    distance: 1.12,
    tilt: 18,
    spin: 25,
    fov: 50,
    // Distance fog from the front of the sphere: the far side sinks into the
    // background, which is what makes the volume read.
    fog: 0.12
  },

  colors: {
    hueBy: "rank" as "rank" | "link" | "node",
    hueSpeed: 0.5,
    hueSpread: 2,
    huePhase: 2.6,
    lengthHueShift: -0.25,
    pipeHueShift: 0.6,
    shimmer: 2.2,
    saturation: 0.8,
    brightness: 1.25
  },

  light: {
    // The light rides on the camera's spin, so an orbit never passes behind it.
    follow: true,
    azimuth: -1.1,
    elevation: 0.45,
    ambient: 0.3,
    diffuse: 0.75,
    specular: 1.1,
    specPower: 42,
    fresnelPower: 2.2,
    rimStrength: 0.6,
    shadowSoftness: 0
  },

  aberration: {
    amount: 0,
    mode: "radial" as "radial" | "horizontal"
  },

  rendering: {
    resolutionScale: 0.7
  },

  backgroundColor: [
    0,
    0,
    0
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  points: {
    component: "nested-object",
    label: "Points (a sphere with a skin)",
    fields: {
      placement: {
        label: "Placement",
        component: "select",
        options: [
          {
            value: "both",
            label: "Skin + inside"
          },
          {
            value: "surface",
            label: "Skin only"
          },
          {
            value: "volume",
            label: "Inside only"
          }
        ]
      },
      skin: {
        label: "Share on the skin (skin + inside)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      count: {
        label: "Count",
        component: "slider",
        min: 4,
        max: 72,
        step: 1
      },
      seed: {
        label: "Seed (positions, links, thickness variation)",
        component: "slider",
        min: 1,
        max: 999,
        step: 1
      },
      spacing: {
        label: "Evenness (0 = pure chance, 1 = even)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      radius: {
        label: "Radius (world)",
        component: "slider",
        min: 0.3,
        max: 4,
        step: 0.05
      }
    }
  },

  links: {
    component: "nested-object",
    label: "Links",
    fields: {
      neighbours: {
        label: "Nearest neighbours per point",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      reach: {
        label: "Reach (longest link, fraction of the radius)",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.01
      },
      density: {
        label: "Density (chance of keeping a link)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },

  wave: {
    component: "nested-object",
    label: "Wave",
    fields: {
      mode: {
        label: "Direction",
        component: "select",
        options: [
          {
            value: "radial-out",
            label: "Radial, from the centre outward"
          },
          {
            value: "radial-in",
            label: "Radial, closing on the centre"
          },
          {
            value: "left-right",
            label: "Left → right"
          },
          {
            value: "right-left",
            label: "Right → left"
          },
          {
            value: "top-down",
            label: "Top → bottom"
          },
          {
            value: "bottom-up",
            label: "Bottom → top"
          },
          {
            value: "front-back",
            label: "Front → back (through the depth)"
          },
          {
            value: "back-front",
            label: "Back → front"
          },
          {
            value: "diagonal",
            label: "Diagonal"
          },
          {
            value: "noise",
            label: "Noise (islands)"
          },
          {
            value: "random",
            label: "Random (each link on its own)"
          },
          {
            value: "cursor",
            label: "From the cursor (real, or the virtual one)"
          }
        ]
      },
      effect: {
        label: "Effect",
        component: "select",
        options: [
          {
            value: "grow",
            label: "Grow (pose, hold, withdraw)"
          },
          {
            value: "grow-swell",
            label: "Grow + swell"
          },
          {
            value: "swell",
            label: "Swell (thickness pulses)"
          },
          {
            value: "reveal",
            label: "Reveal (whole link pops in and out)"
          },
          {
            value: "none",
            label: "None (still sculpture)"
          }
        ]
      },
      count: {
        label: "Waves per loop",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      },
      spread: {
        label: "Spread across the sculpture (0 = all at once)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      rise: {
        label: "Pose duration (fraction of a link's cycle)",
        component: "slider",
        min: 0.02,
        max: 0.5,
        step: 0.01
      },
      hold: {
        label: "Hold duration",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      swell: {
        label: "Swell at the crest",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      easing: {
        label: "Pose / withdraw easing",
        component: "easing"
      },
      jitter: {
        label: "Jitter (noise on the front)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      frequency: {
        label: "Noise frequency (noise mode)",
        component: "slider",
        min: 0.2,
        max: 6,
        step: 0.1
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
            label: "The Head slider below — bind it to scrub by hand",
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

  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      drift: {
        label: "Drift amplitude (fraction of the radius)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.005
      },
      driftCycles: {
        label: "Drift cycles per loop",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      },
      driftScale: {
        label: "Drift coherence (noise scale; low = together)",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      breathe: {
        label: "Breathe (radius pulse amplitude)",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      breatheCycles: {
        label: "Breathe cycles per loop",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      },
      spin: {
        label: "Spin (turns per loop, about y)",
        component: "slider",
        min: -3,
        max: 3,
        step: 1
      }
    }
  },

  cursor: {
    component: "nested-object",
    label: "Cursor",
    fields: {
      pull: {
        label: "Pull",
        component: "select",
        options: [
          {
            value: "attract",
            label: "Attract the points"
          },
          {
            value: "repel",
            label: "Repel the points"
          },
          {
            value: "none",
            label: "None (the cursor only sources the wave)"
          }
        ]
      },
      range: {
        label: "Range (fraction of the canvas's short side)",
        component: "slider",
        min: 0.02,
        max: 1,
        step: 0.01
      },
      strength: {
        label: "Strength (max displacement, same unit)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.005
      },
      speed: {
        label: "Chase speed (top = instant)",
        component: "slider",
        min: 0.1,
        max: 30,
        step: 0.1
      },
      falloff: {
        label: "Well falloff",
        component: "easing"
      },
      virtual: {
        label: "Virtual cursor (scripted, for exports)",
        component: "select",
        options: [
          {
            value: "none",
            label: "None"
          },
          {
            value: "circle",
            label: "Circle around the centre"
          },
          {
            value: "lissajous",
            label: "Lissajous (3 : 2)"
          },
          {
            value: "sweep",
            label: "Horizontal sweep"
          }
        ]
      },
      virtualCycles: {
        label: "Virtual cursor cycles per loop",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      },
      virtualRadius: {
        label: "Virtual cursor radius (fraction of the short side)",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      showCursor: {
        label: "Show the cursor markers",
        component: "checkbox"
      }
    }
  },

  // Focused subset of the shared interaction form: only the modalities this
  // sketch reads (mouse, touch, camera hands).
  interaction: {
    component: "nested-object",
    label: "Input sources",
    fields: {
      enabled: interactionFormConfiguration.fields.enabled,
      mouse: interactionFormConfiguration.fields.mouse,
      touch: interactionFormConfiguration.fields.touch,
      vision: {
        ...interactionFormConfiguration.fields.vision,
        fields: {
          ...interactionFormConfiguration.fields.vision.fields,
          hands: {
            ...interactionFormConfiguration.fields.vision.fields.hands,
            fields: {
              ...interactionFormConfiguration.fields.vision.fields.hands.fields,
              maxHands: {
                component: "slider",
                label: "Max hands",
                min: 1,
                max: 10,
                step: 1
              }
            }
          }
        }
      }
    }
  },

  material: {
    component: "nested-object",
    label: "Material",
    fields: {
      look: {
        label: "Look",
        component: "select",
        options: [
          {
            value: "tube",
            label: "Tube — the lit material"
          },
          {
            value: "fringe",
            label: "Fringe — the silhouette bands alone"
          }
        ]
      },
      thickness: {
        label: "Tube thickness",
        component: "slider",
        min: 0.005,
        max: 0.35,
        step: 0.005
      },
      variation: {
        label: "Thickness variation between links (seeded)",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      fusion: {
        label: "Junction fusion (smooth-union fillet)",
        component: "slider",
        min: 0.001,
        max: 0.25,
        step: 0.001
      },
      nodes: {
        label: "Beads at the points (× thickness, 0 = none)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      taper: {
        label: "Taper of a growing tip (0 = plain capsule)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      fringeWidth: {
        label: "Fringe width (0.25 wide → 12 a hairline)",
        component: "slider",
        min: 0.25,
        max: 12,
        step: 0.05
      },
      fringeGlow: {
        label: "Fringe glow",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.05
      },
      fringeBody: {
        label: "Fringe body (0 = black inside the bands)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },

  camera: {
    ...cameraFormConfiguration,
    fields: {
      ...cameraFormConfiguration.fields,
      fog: {
        label: "Fog density (from the front of the sphere)",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.005
      }
    }
  },

  colors: {
    component: "nested-object",
    label: "Iridescent",
    fields: {
      hueBy: {
        label: "Hue carried by",
        component: "select",
        options: [
          {
            value: "rank",
            label: "The wave (rank along the front)"
          },
          {
            value: "link",
            label: "Each link (fixed identity)"
          },
          {
            value: "node",
            label: "The source node"
          }
        ]
      },
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
        label: "Height hue shift",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      pipeHueShift: {
        label: "Hue shift by identity",
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
      follow: {
        label: "Light follows the camera (off = fixed in the world)",
        component: "checkbox"
      },
      azimuth: {
        label: "Light azimuth (relative to the camera when it follows)",
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
        label: "Tube shadows (0 = off, higher = harder)",
        component: "slider",
        min: 0,
        max: 64,
        step: 1
      }
    }
  },

  aberration: {
    component: "nested-object",
    label: "Chromatic aberration",
    fields: {
      amount: {
        label: "Amount px (0 = off)",
        component: "slider",
        min: 0,
        max: 40,
        step: 0.5
      },
      mode: {
        label: "Direction",
        component: "select",
        options: [
          {
            label: "Radial",
            value: "radial"
          },
          {
            label: "Horizontal",
            value: "horizontal"
          }
        ]
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
