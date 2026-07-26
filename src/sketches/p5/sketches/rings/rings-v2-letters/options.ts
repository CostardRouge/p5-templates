import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

export const formValues = {
  timeScale: 1,
  text: {
    value: "2027isnextyearalready",
    font: "agiro",
    detail: 1,
    spacing: 0.12,
    simplify: 0
  },
  material: {
    size: 2.1,
    thickness: 0.02,
    fusion: 0.25
  },
  path: {
    spread: 2,
    waveAmplitude: 1.09,
    waveCycles: 2,
    wobble: 0.18,
    wobbleCycles: 1
  },
  camera: {
    fov: 109,
    motion: "ease" as "flow" | "ease",
    lookAhead: 2.75,
    easing: "easeInOutCubic",
    glide: 0.48,
    bank: -0.64
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
    ambient: 0.3,
    diffuse: 0.75,
    specular: 1.04,
    specPower: 31,
    fresnelPower: 1.62,
    rimStrength: 0,
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
      value: {
        label: "Word (max 8 letters)",
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
        label: "Tube thickness (auto-capped to keep the gap open)",
        component: "slider",
        min: 0.02,
        max: 0.35,
        step: 0.01
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
  path: {
    component: "nested-object",
    label: "Circuit (spacing)",
    fields: {
      spread: {
        label: "Spacing (tight ↔ far apart)",
        component: "slider",
        min: 2,
        max: 14,
        step: 0.05
      },
      waveAmplitude: {
        label: "Vertical wave amplitude",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      waveCycles: {
        label: "Vertical wave cycles",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      wobble: {
        label: "Radial wobble",
        component: "slider",
        min: 0,
        max: 0.4,
        step: 0.01
      },
      wobbleCycles: {
        label: "Radial wobble cycles",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
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
      motion: {
        label: "Motion",
        component: "select",
        options: [
          {
            label: "Flow (smooth, never stops)",
            value: "flow"
          },
          {
            label: "Ease into each letter",
            value: "ease"
          }
        ]
      },
      lookAhead: {
        label: "Look ahead (Flow: how far the gaze anticipates)",
        component: "slider",
        min: 0.2,
        max: 4,
        step: 0.05
      },
      easing: {
        label: "Approach easing (Ease mode, per letter)",
        component: "easing"
      },
      glide: {
        label: "Glide (Ease mode: 0 = constant speed, 1 = dwell at each letter)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      bank: {
        label: "Bank into turns (FPV roll)",
        component: "slider",
        min: -2,
        max: 2,
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
