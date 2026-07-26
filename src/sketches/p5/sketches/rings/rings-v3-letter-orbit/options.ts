import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

export const formValues = {
  timeScale: 1,
  text: {
    value: "x",
    font: "multicoloure",
    detail: 1,
    spacing: 0.12,
    simplify: 0
  },
  material: {
    size: 2.45,
    thickness: 0.02,
    fusion: 0.215
  },
  camera: {
    fov: 59,
    distance: 4.4,
    orbit: 1,
    phase: 0,
    elevation: 0.05,
    bob: 0,
    bobCycles: 1,
    motion: "flow" as "flow" | "ease",
    easing: "easeInOutCubic",
    glide: 0.48
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
      value: {
        label: "Letter / word (max 8 letters)",
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
        label: "Elevation (look down ↔ up at the letter)",
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
