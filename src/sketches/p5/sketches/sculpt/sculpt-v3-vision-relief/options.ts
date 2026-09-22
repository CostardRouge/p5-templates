import {
  interactionFormConfiguration, interactionFormValues
} from "@/p5/utils/interaction/defaults.js";

// A sheet of nodes seen from above. What the camera sees — hands, a face, a
// body — is traced as a surface on the sheet; the nodes under it lift, and
// the rings material's tubes join neighbours that are up, so the relief draws
// the silhouette and the gaps in it stay empty. The mouse stamps the same
// brush, and a virtual hand wanders the sheet when nothing has been seen for
// a while (that is what an export without a camera shows).
export const formValues = {
  sheet: {
    layout: "hex",
    columns: 10,
    jitter: 0.04,
    seed: 7,
    margin: 0.02,
    drift: 0.18,
    driftCycles: 1
  },

  // The silhouette: traced from landmarks (capsules and polygons), or read
  // off the segmentation mask. Which trackers run is Input sources → Vision.
  detect: {
    mode: "landmarks",
    thickness: 1.25,
    feather: 0.8,
    smoothing: 0.22,
    maskDilate: 2,
    maskBlur: 2
  },

  // Presence → height. Times are seconds to reach 95%.
  lift: {
    height: 1,
    curve: "easeOutCubic",
    rise: 0.25,
    fall: 1.2,
    hold: 0.4,
    order: "radial",
    stagger: 0.3,
    profile: "plateau",
    dome: 1.5,
    rim: 0.6,
    spread: 1,
    spreadGain: 0.35,
    threshold: 0.08
  },

  // A tube joins two grid neighbours; `both` is what keeps an O an O.
  links: {
    diagonals: true,
    require: "both",
    threshold: 0.31,
    fade: 0.3,
    rest: "none"
  },

  material: {
    // tube: the lit material · fringe: only the rainbow bands every tube
    // carries at its silhouette — the artefact, kept on purpose.
    look: "tube" as "tube" | "fringe",
    fringeWidth: 1,
    fringeGlow: 3,
    fringeBody: 0.1,
    thickness: 0.14,
    thicknessLift: 0.115,
    fusion: 0.154,
    beads: 0.06,
    beadsLift: 0.08,
    taper: 0.45
  },

  // Top-down, tilted. Every field is a slider, so the eye is bindable.
  camera: {
    projection: "ortho",
    tilt: 0.38,
    yaw: 0,
    zoom: 1,
    fov: 45,
    orbit: 0,
    sway: 0,
    swayCycles: 1,
    fog: 0
  },

  cursor: {
    enabled: false,
    shape: "hand",
    size: 6.4,
    showMarkers: false
  },

  idle: {
    enabled: true,
    after: 0,
    fade: 0,
    shape: "hand",
    size: 5.6,
    path: "circle",
    cycles: 2,
    spin: 3,
    // `manual` parks the virtual hand at loop position `head` (a scrub, for
    // checking a frame); `clock` flies the path.
    headMode: "clock",
    head: 0
  },

  // Mouse + touch as the brush; the camera on, hands and the face mesh
  // tracked, the body off (its model is the heavy one).
  interaction: {
    ...interactionFormValues,
    enabled: false,
    mouse: {
      ...interactionFormValues.mouse,
      enabled: false
    },
    touch: {
      ...interactionFormValues.touch,
      enabled: false
    },
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false
    },
    vision: {
      ...interactionFormValues.vision,
      enabled: false,
      source: {
        ...interactionFormValues.vision.source,
        showPreview: false
      },
      hands: {
        ...interactionFormValues.vision.hands,
        enabled: true
      },
      faceMesh: {
        ...interactionFormValues.vision.faceMesh,
        enabled: true,
        blendshapes: false
      }
    }
  },

  colors: {
    hueSpeed: 0.5,
    hueSpread: 2,
    huePhase: 2.6,
    lengthHueShift: -0.6,
    pipeHueShift: 0.3,
    shimmer: 2.2,
    saturation: 0.8,
    brightness: 1.25
  },

  light: {
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
    mode: "radial"
  },

  rendering: {
    resolutionScale: 0.95
  },

  backgroundColor: [
    4,
    5,
    9
  ]
};

const select = (
  label: string, values: Array<[string, string]>
) => ( {
  label,
  component: "select",
  options: values.map( ( [
    value,
    text
  ] ) => ( {
    value,
    label: text
  } ) )
} );

export const formConfiguration: Record<string, any> = {
  sheet: {
    component: "nested-object",
    label: "Sheet",
    fields: {
      layout: select(
        "Lattice",
        [
          [
            "square",
            "Square (4 or 8 neighbours)"
          ],
          [
            "hex",
            "Hexagonal (6 neighbours)"
          ]
        ]
      ),
      columns: {
        label: "Columns (density; rows follow the canvas)",
        component: "slider",
        min: 8,
        max: 64,
        step: 1
      },
      jitter: {
        label: "Jitter (cells; bounded by the tube width)",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.01
      },
      seed: {
        label: "Seed",
        component: "slider",
        min: 0,
        max: 9999,
        step: 1
      },
      margin: {
        label: "Margin (fraction of the canvas)",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.01
      },
      drift: {
        label: "Drift of the rest positions (cells)",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.01
      },
      driftCycles: {
        label: "Drift cycles per loop",
        component: "slider",
        min: 1,
        max: 4,
        step: 1
      }
    }
  },

  detect: {
    component: "nested-object",
    label: "Silhouette",
    fields: {
      mode: select(
        "Traced from",
        [
          [
            "landmarks",
            "Landmarks (capsules + polygons)"
          ],
          [
            "mask",
            "Segmentation mask (DeepLab)"
          ]
        ]
      ),
      thickness: {
        label: "Finger / limb thickness (× anatomy)",
        component: "slider",
        min: 0.2,
        max: 3,
        step: 0.05
      },
      feather: {
        label: "Edge feather (cells)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      smoothing: {
        label: "Landmark smoothing",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      maskDilate: {
        label: "Mask dilation (px, mask mode)",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      maskBlur: {
        label: "Mask blur (px, mask mode)",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      }
    }
  },

  lift: {
    component: "nested-object",
    label: "Lift",
    fields: {
      height: {
        label: "Height (cells)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      curve: {
        label: "Presence → height curve",
        component: "easing",
        default: "easeOutCubic"
      },
      rise: {
        label: "Rise time (s)",
        component: "slider",
        min: 0.01,
        max: 2,
        step: 0.01
      },
      fall: {
        label: "Fall time (s)",
        component: "slider",
        min: 0.01,
        max: 4,
        step: 0.01
      },
      hold: {
        label: "Hold before falling (s)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      order: select(
        "Lift order inside the silhouette",
        [
          [
            "instant",
            "All at once"
          ],
          [
            "radial",
            "From the centre outward"
          ],
          [
            "sweep-x",
            "Sweep left → right"
          ],
          [
            "sweep-y",
            "Sweep top → bottom"
          ],
          [
            "noise",
            "Noise"
          ]
        ]
      ),
      stagger: {
        label: "Stagger, first → last rank (s)",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      profile: select(
        "Relief profile",
        [
          [
            "plateau",
            "Plateau (the whole surface)"
          ],
          [
            "dome",
            "Dome (higher toward the middle)"
          ],
          [
            "rim",
            "Rim (only the edge band)"
          ]
        ]
      ),
      dome: {
        label: "Dome depth (cells)",
        component: "slider",
        min: 0.2,
        max: 6,
        step: 0.1
      },
      rim: {
        label: "Rim width (cells)",
        component: "slider",
        min: 0.2,
        max: 4,
        step: 0.1
      },
      spread: {
        label: "Contagion radius (cells)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.1
      },
      spreadGain: {
        label: "Contagion gain",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      threshold: {
        label: "Presence threshold",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      }
    }
  },

  links: {
    component: "nested-object",
    label: "Links (tubes)",
    fields: {
      diagonals: {
        label: "Diagonal links (square lattice)",
        component: "checkbox"
      },
      require: select(
        "A tube needs",
        [
          [
            "both",
            "Both ends lifted"
          ],
          [
            "any",
            "Either end lifted"
          ]
        ]
      ),
      threshold: {
        label: "Height that lights a link",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      fade: {
        label: "Fade-in span (height)",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01
      },
      rest: select(
        "Links at rest",
        [
          [
            "none",
            "None (beads only)"
          ],
          [
            "thin",
            "Thin wires"
          ],
          [
            "full",
            "Full tubes"
          ]
        ]
      )
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
        label: "Tube radius (cells)",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      },
      thicknessLift: {
        label: "Tube radius gained with height",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      },
      fusion: {
        label: "Junction fusion (smooth-union fillet)",
        component: "slider",
        min: 0.001,
        max: 0.2,
        step: 0.001
      },
      beads: {
        label: "Bead radius at rest (cells)",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      },
      beadsLift: {
        label: "Bead radius gained with height",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      },
      taper: {
        label: "Taper (each end its own radius)",
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
    component: "nested-object",
    label: "Camera (top-down)",
    fields: {
      projection: select(
        "Projection",
        [
          [
            "ortho",
            "Orthographic"
          ],
          [
            "perspective",
            "Perspective"
          ]
        ]
      ),
      tilt: {
        label: "Tilt (0 = straight down)",
        component: "slider",
        min: 0,
        max: 1.45,
        step: 0.01
      },
      yaw: {
        label: "Yaw",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      zoom: {
        label: "Zoom",
        component: "slider",
        min: 0.3,
        max: 3,
        step: 0.01
      },
      fov: {
        label: "Field of view ° (perspective)",
        component: "slider",
        min: 20,
        max: 110,
        step: 1
      },
      orbit: {
        label: "Orbit turns per loop",
        component: "slider",
        min: -2,
        max: 2,
        step: 1
      },
      sway: {
        label: "Tilt sway amplitude",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      swayCycles: {
        label: "Sway cycles per loop",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      fog: {
        label: "Fog density",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      }
    }
  },

  cursor: {
    component: "nested-object",
    label: "Cursor brush (mouse / touch)",
    fields: {
      enabled: {
        label: "Enabled",
        component: "checkbox"
      },
      shape: select(
        "Shape",
        [
          [
            "hand",
            "Hand"
          ],
          [
            "disc",
            "Disc"
          ],
          [
            "oval",
            "Oval"
          ]
        ]
      ),
      size: {
        label: "Size (cells)",
        component: "slider",
        min: 0.5,
        max: 12,
        step: 0.1
      },
      showMarkers: {
        label: "Show pointer markers",
        component: "checkbox"
      }
    }
  },

  idle: {
    component: "nested-object",
    label: "Idle (virtual hand)",
    fields: {
      enabled: {
        label: "Enabled",
        component: "checkbox"
      },
      after: {
        label: "After nothing seen for (s)",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      fade: {
        label: "Fade in / out (s)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.05
      },
      shape: select(
        "Shape",
        [
          [
            "hand",
            "Hand"
          ],
          [
            "disc",
            "Disc"
          ],
          [
            "oval",
            "Oval"
          ]
        ]
      ),
      size: {
        label: "Size (cells)",
        component: "slider",
        min: 0.5,
        max: 12,
        step: 0.1
      },
      path: select(
        "Path (closed on the loop)",
        [
          [
            "lissajous",
            "Lissajous (in from the side)"
          ],
          [
            "circle",
            "Circle"
          ],
          [
            "sweep",
            "Sweep across"
          ]
        ]
      ),
      cycles: {
        label: "Cycles per loop",
        component: "slider",
        min: 1,
        max: 4,
        step: 1
      },
      spin: {
        label: "Turns per loop",
        component: "slider",
        min: -3,
        max: 3,
        step: 1
      },
      headMode: select(
        "Position",
        [
          [
            "clock",
            "Flies the path on the loop clock"
          ],
          [
            "manual",
            "Parked at the head below"
          ]
        ]
      ),
      head: {
        label: "Head (loop position, manual)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.001
      }
    }
  },

  // The shared interaction form, reduced to what this sketch reads: mouse,
  // touch and the camera trackers.
  interaction: {
    component: "nested-object",
    label: "Input sources",
    fields: {
      enabled: interactionFormConfiguration.fields.enabled,
      mouse: interactionFormConfiguration.fields.mouse,
      touch: interactionFormConfiguration.fields.touch,
      vision: interactionFormConfiguration.fields.vision
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
        label: "Height hue shift",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      },
      pipeHueShift: {
        label: "Per-node hue shift",
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
        label: "Light follows the camera yaw",
        component: "checkbox"
      },
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
        label: "Cast shadows (0 = off, higher = harder)",
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
        label: "Amount (px)",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.1
      },
      mode: select(
        "Mode",
        [
          [
            "radial",
            "Radial"
          ],
          [
            "horizontal",
            "Horizontal"
          ]
        ]
      )
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
