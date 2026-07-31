import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// One glyph of the v4 liquid-tube material, sculpted by hand: every outline
// sample is a draggable 3D handle. Thumb + index pinch (or mouse / finger)
// drags a handle in the letter plane; thumb + MIDDLE pinch (index extended) or
// SHIFT + mouse-drag pushes/pulls it in depth. The sculpt offsets are
// persisted below (signature-guarded, hidden from the form) so a sculpted
// letter survives reloads and is exported with the template.
export const formValues = {
  timeScale: 1,

  text: {
    value: "R",
    font: "agiro",
    detail: 1,
    simplify: 0
  },

  material: {
    size: 2.65,
    thickness: 0.065,
    fusion: 0.061
  },

  sculpt: {
    // Handles along the glyph outlines (regenerates the layout — and resets
    // the sculpt, like any letter/font/detail change).
    handles: 48,
    // Max displacement of a handle (glyph units; the glyph is ~1 unit tall).
    range: 1,
    // Depth gesture gain (negative inverts push/pull).
    depthGain: 1,
    // Persisted sculpt state (no form UI): one { x, y, z } offset per handle,
    // tied to the glyph build it was sculpted on. Any mismatch resets flat.
    signature: "R|Agiro|1|0|48",
    offsets: [
      {
        x: -0.21170444399515848,
        y: -0.06802171578805415,
        z: 0
      },
      {
        x: -0.042118784438434864,
        y: 0.027028418603034475,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: -0.21946350407513882,
        y: -0.05260812091787642,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0.04850139001551386,
        y: -0.22852607135107167,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0.16951137342991202,
        y: -0.17504254091995064,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0.03607440318754379,
        y: 0.03479665148252717,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: -0.005183930470199077,
        y: 0.002794110814276274,
        z: 0
      },
      {
        x: 0.13620294286133006,
        y: -0.11351494991822686,
        z: 0
      },
      {
        x: 0.039559954651134654,
        y: -0.041807105069258804,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0.1489304436469197,
        y: 0.1984694125069,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0.006055862554250488,
        y: -0.0051327578642014204,
        z: 0
      },
      {
        x: 0.09408129549255115,
        y: 0.19133003874285237,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: -0.018284773696345402,
        y: 0.01912858769082021,
        z: 0
      },
      {
        x: -0.17327609602087068,
        y: 0.1500617451145403,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: -0.2616987644378602,
        y: -0.04512527787408748,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0.0195155744550885,
        y: 0.1451144813030183,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0.07497695895466702,
        y: 0.07535557221914828,
        z: 0
      },
      {
        x: 0.09841311039386688,
        y: -0.0021783460979366565,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0.034950380002518704,
        y: -0.09363804803023874,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      },
      {
        x: -0.1158367700845003,
        y: 0.08498862243234873,
        z: 0
      },
      {
        x: 0.1371266176389777,
        y: 0.007641035089214002,
        z: 0
      },
      {
        x: 0,
        y: 0,
        z: 0
      }
    ] as Array<{ x: number;
      y: number;
      z: number }>
  },

  grab: {
    // Pick-up radius (px) around a handle: a press/touch/pinch within it grabs it.
    radius: 120,
    // Camera pinch: the finger tips must be closer than this (px) to count as
    // "pressed". Released at 1.6× this (hysteresis). Shared by both gestures.
    pinch: 70,
    // EMA lag on the pinch midpoint to calm jittery hand landmarks (0 = none,
    // higher = smoother but laggier). Mouse / touch stay unsmoothed.
    cameraSmoothing: 0.4
  },

  // Mouse + touch + camera hands drive the sculpting. Touch MUST stay enabled
  // so the viewport hands the touchscreen to the sketch instead of panning.
  // Vision is armed (Hands pre-selected for the pinches) but starts OFF — flip
  // Vision → Enabled to sculpt by pinching; raise Max hands to let a small
  // crowd of hands sculpt the letter together.
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

  // The usual hand-capture look for detected hands: a glowing spline through
  // the fingertips, plus the per-hand pinch markers (always on).
  hands: {
    show: false,
    weight: 14,
    glow: 2,
    iterations: 5,
    hueSpeed: 1.5,
    hueSpread: 2
  },

  camera: {
    fov: 62,
    distance: 6.5,
    // A touch of yaw/elevation so the sculpted relief reads at rest; sculpting
    // stays exact at any angle (the CPU mirrors the shader camera).
    phase: 0.42,
    elevation: 0.34,
    orbit: -1,
    sway: 0.4,
    swayCycles: 2,
    fogDensity: 0.06
  },

  colors: {
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

  overlay: {
    points: {
      show: true,
      size: 25,
      coreRatio: 0.82,
      color: [
        255,
        255,
        255,
        255
      ] as number[],
      coreColor: [
        10,
        10,
        14,
        255
      ] as number[]
    }
  },

  backgroundColor: [
    0,
    0,
    0
  ] as number[]
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
    label: "Letter",
    fields: {
      value: {
        label: "Letter (first character is used)",
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
      simplify: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
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
        max: 5,
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

  // Only the sculpt knobs are exposed — `signature` / `offsets` are the
  // persisted sculpt state, written by the sketch on every release.
  sculpt: {
    component: "nested-object",
    label: "Sculpt",
    fields: {
      handles: {
        label: "Handles along the outline (resets the sculpt)",
        component: "slider",
        min: 12,
        max: 64,
        step: 1
      },
      range: {
        label: "Reach (max displacement, glyph units)",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.05
      },
      depthGain: {
        label: "Depth gesture gain (negative inverts)",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.1
      }
    }
  },

  grab: {
    label: "Grab",
    component: "nested-object",
    fields: {
      radius: {
        label: "Pick-up radius (px)",
        component: "slider",
        min: 10,
        max: 120,
        step: 1
      },
      pinch: {
        label: "Camera pinch distance (px)",
        component: "slider",
        min: 20,
        max: 200,
        step: 1
      },
      cameraSmoothing: {
        label: "Camera smoothing",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.05
      }
    }
  },

  // Focused subset of the shared interaction form: only the modalities this
  // sketch reads (mouse, touch, camera hands). The Max-hands slider is widened
  // beyond the shared default so a whole crowd of hands can sculpt at once.
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

  hands: {
    label: "Hand visuals",
    component: "nested-object",
    fields: {
      show: {
        label: "Show hand ribbons",
        component: "checkbox"
      },
      weight: {
        label: "Ribbon weight",
        component: "slider",
        min: 2,
        max: 40,
        step: 0.5
      },
      glow: {
        label: "Glow layers",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      iterations: {
        label: "Chaikin iterations",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      hueSpeed: {
        label: "Hue speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.05
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
        min: 30,
        max: 110,
        step: 1
      },
      distance: {
        label: "Distance from the letter",
        component: "slider",
        min: 0.5,
        max: 12,
        step: 0.05
      },
      phase: {
        label: "Yaw (viewpoint angle)",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      elevation: {
        label: "Elevation (look down ↔ up at the letter)",
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
      fogDensity: {
        label: "Fog density (depth cue on pushed points)",
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
        label: "Outline hue shift",
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

  overlay: {
    label: "Sculpt handle markers",
    component: "nested-object",
    fields: {
      points: {
        label: "Handles",
        component: "nested-object",
        fields: {
          show: {
            label: "Show handles",
            component: "checkbox"
          },
          size: {
            label: "Size (diameter)",
            component: "slider",
            min: 0,
            max: 60,
            step: 0.5
          },
          coreRatio: {
            label: "Inner core ratio",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.02
          },
          color: {
            label: "Color",
            component: "color"
          },
          coreColor: {
            label: "Inner core color",
            component: "color"
          }
        }
      }
    }
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
