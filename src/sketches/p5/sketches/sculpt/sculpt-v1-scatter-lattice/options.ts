import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// A seeded cloud of points linked to their nearest neighbours, every link a
// tube of the rings material, and a wave that poses, swells and withdraws the
// tubes as its front crosses the sculpture. See index.js for the rules (links
// on rest positions, the wave in the sculpture's own frame, the cursor as the
// only state) and ../_lattice.js / ../_wave.js for the shared geometry.
export const formValues = {
  points: {
    count: 40,
    seed: 7,
    // Minimum distance between points, as a fraction of the cell size for this
    // count: 0 is pure chance, 1 is almost a regular packing.
    spacing: 0.6,
    volume: "sphere" as "sphere" | "box" | "disc" | "shell",
    // World size of the volume.
    radius: 1.6,
    // Depth squash: 0 is a flat sculpture facing the camera, 1 the full volume.
    // Kept above a half so the orbit's edge-on moments still show a body
    // rather than a sliver.
    flatten: 0.55
  },

  links: {
    neighbours: 2,
    // Longest link allowed, as a fraction of the radius.
    reach: 0.7,
    // Seeded probability of keeping each link.
    density: 1
  },

  wave: {
    mode: "radial-out" as "radial-out" | "radial-in" | "left-right" | "right-left" | "top-down" | "bottom-up" | "front-back" | "back-front" | "diagonal" | "noise" | "random" | "cursor",
    effect: "grow-swell" as "grow-swell" | "grow" | "swell" | "reveal" | "none",
    // Waves per loop (whole numbers, so the capture closes).
    count: 2,
    // How staggered the front is across the sculpture: 0 = everything at
    // once, 1 = the front takes one whole wave to cross it.
    spread: 1,
    // Pose and hold, as fractions of a link's cycle; the withdraw lasts as
    // long as the pose. The hold is shortened first if the three overflow.
    rise: 0.25,
    hold: 0.2,
    // Radius gain at the crest (× 1 + swell).
    swell: 0.8,
    easing: "easeInOutCubic",
    // Seeded noise on the rank — breaks the regularity of the front.
    jitter: 0,
    // Spatial frequency of the `noise` mode.
    frequency: 1.5,
    headMode: "clock" as "clock" | "manual",
    head: 0
  },

  motion: {
    // Drift of the points (fraction of the radius), sampled from a seeded
    // value noise on a circle so whole cycles close the loop.
    drift: 0.08,
    driftCycles: 1,
    driftScale: 1.2,
    // The whole cloud's radius breathes (amplitude, whole cycles per loop).
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
  // Vision → Enabled and Hands → Enabled to let fingertips tug the sculpture).
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
    thickness: 0.06,
    // Seeded spread of thickness between links.
    variation: 0.3,
    fusion: 0.08,
    // Bulb at every point, as a multiple of the thickness (0 = none).
    nodes: 1.8
  },

  camera: {
    fov: 55,
    autoFit: true,
    margin: 0.1,
    distance: 6,
    yaw: 0.4,
    elevation: 0.3,
    orbit: 1,
    sway: 0.2,
    swayCycles: 2,
    fog: 0.05
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
    // The light rides on the camera's yaw, so an orbit never passes behind it.
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

  rendering: {
    resolutionScale: 0.7
  },

  backgroundColor: [
    0,
    0,
    0
  ] as number[]
};

const choices = ( values: string[] ) => values.map( ( value ) => ( {
  value,
  label: value
} ) );

export const formConfiguration: Record<string, any> = {
  points: {
    component: "nested-object",
    label: "Points",
    fields: {
      count: {
        label: "Count",
        component: "slider",
        min: 4,
        max: 48,
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
        label: "Spacing (0 = pure chance, 1 = even)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      volume: {
        label: "Volume",
        component: "select",
        options: choices( [
          "sphere",
          "box",
          "disc",
          "shell"
        ] )
      },
      radius: {
        label: "Radius (world)",
        component: "slider",
        min: 0.3,
        max: 4,
        step: 0.05
      },
      flatten: {
        label: "Flatten (0 = flat, 1 = full depth)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
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
            value: "grow-swell",
            label: "Grow + swell"
          },
          {
            value: "grow",
            label: "Grow (pose, hold, withdraw)"
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
        label: "Show cursor markers",
        component: "checkbox"
      }
    }
  },

  // The shared interaction form, reduced to what this sketch reads: mouse,
  // touch and camera hands.
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
    label: "Material (tube)",
    fields: {
      thickness: {
        label: "Tube thickness (world)",
        component: "slider",
        min: 0.005,
        max: 0.3,
        step: 0.005
      },
      variation: {
        label: "Thickness variation between links",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      fusion: {
        label: "Junction fusion (smooth-union fillet)",
        component: "slider",
        min: 0.001,
        max: 0.3,
        step: 0.001
      },
      nodes: {
        label: "Node bulbs (× thickness, 0 = none)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.1
      }
    }
  },

  camera: {
    component: "nested-object",
    label: "Camera (orbit)",
    fields: {
      fov: {
        label: "Field of view °",
        component: "slider",
        min: 25,
        max: 110,
        step: 1
      },
      autoFit: {
        label: "Auto-fit the distance to the sculpture",
        component: "checkbox"
      },
      margin: {
        label: "Auto-fit margin",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      distance: {
        label: "Distance (when auto-fit is off)",
        component: "slider",
        min: 0.5,
        max: 14,
        step: 0.05
      },
      yaw: {
        label: "Yaw (viewpoint angle)",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      elevation: {
        label: "Elevation (look down ↔ up)",
        component: "slider",
        min: -1.4,
        max: 1.4,
        step: 0.01
      },
      orbit: {
        label: "Orbit turns per loop (0 = static camera)",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      },
      sway: {
        label: "Vertical sway amplitude (pitch)",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      swayCycles: {
        label: "Vertical sway cycles per loop",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      fog: {
        label: "Fog density (depth cue)",
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
            label: "Each source node"
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
        label: "Link hue shift",
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
        label: "Cast shadows (0 = off, higher = harder)",
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
