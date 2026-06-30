import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

export const formValues = {
  timeScale: 1,

  // The single tube drawn along each finger.
  tube: {
    // Tube radius in pixels.
    thickness: 22,
    // Extra radius added per pixel of finger length, so a finger held closer to
    // the camera (longer on screen) grows a chunkier pipe.
    thicknessByLength: 0.04,
    // Chromatic twist: how many turns the iridescent bands spiral around the
    // tube along its length. 0 = straight bands, no twist (the shape never
    // ripples — this only rotates the colour).
    twist: 1
  },

  // How the finger's joints are rounded into the pipe centreline (Chaikin
  // corner-cutting, the same control-point-free rounding as the splines sketch).
  curve: {
    iterations: 3
  },

  // Finger tracking behaviour.
  finger: {
    // Temporal smoothing of the landmarks (0 = raw, jittery; higher = calmer).
    smoothing: 0.4,
    // Draw a waving fan of pipes when no hand is detected (keeps the preview and
    // the first seconds before a hand appears alive).
    idleDemo: true
  },

  colors: {
    hueSpeed: 0.6,
    hueSpread: 1.6,
    huePhase: 0,
    lengthHueShift: 1.1,
    aroundHueShift: 0.7,
    fingerHueShift: 0.3,
    shimmer: 1.2,
    saturation: 0.9,
    brightness: 1.3
  },

  light: {
    azimuth: -1.29,
    elevation: -0.6,
    ambient: 0.3,
    diffuse: 0.75,
    specular: 0.85,
    specPower: 28,
    fresnelPower: 3,
    rimStrength: 0.8,
    occlusion: 0.5
  },

  aberration: {
    amount: 2,
    mode: "radial" as "radial" | "horizontal"
  },

  // Vision is armed with the per-finger tracker so showing a hand immediately
  // grows a pipe on every finger. Orbit is off — this sketch is hand-driven.
  interaction: {
    ...interactionFormValues,
    vision: {
      ...interactionFormValues.vision,
      enabled: true,
      fingers: {
        ...interactionFormValues.vision.fingers,
        enabled: true
      }
    },
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false
    }
  },

  backgroundColor: [
    0,
    0,
    0
  ],

  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  timeScale: {
    label: "Time scale",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.01
  },
  tube: {
    component: "nested-object",
    label: "Tube",
    fields: {
      thickness: {
        label: "Thickness (px)",
        component: "slider",
        min: 4,
        max: 90,
        step: 1
      },
      thicknessByLength: {
        label: "Thickness × finger length",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      },
      twist: {
        label: "Colour twist (turns)",
        component: "slider",
        min: -6,
        max: 6,
        step: 0.05
      }
    }
  },
  curve: {
    component: "nested-object",
    label: "Curve (joint rounding)",
    fields: {
      iterations: {
        label: "Chaikin iterations",
        component: "slider",
        min: 0,
        max: 5,
        step: 1
      }
    }
  },
  finger: {
    component: "nested-object",
    label: "Finger tracking",
    fields: {
      smoothing: {
        label: "Smoothing (anti-jitter)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.05
      },
      idleDemo: {
        label: "Idle demo (no hand)",
        component: "checkbox"
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Iridescent",
    fields: {
      hueSpeed: {
        label: "Hue speed",
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
        label: "Length hue shift",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01
      },
      aroundHueShift: {
        label: "Around-tube hue shift",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      },
      fingerHueShift: {
        label: "Finger hue shift",
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
      occlusion: {
        label: "Ambient occlusion",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
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
  interaction: interactionFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
