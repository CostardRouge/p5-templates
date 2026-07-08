import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "5",
    font: "martian",
    depth: 20,
    size: 1,
    columns: 65,
    sampleFactor: 0.1,
    simplifyThreshold: 0
  },
  mask: {
    distance: 0.015
  },
  animation: {
    variableDepth: false,
    rotate: true,
    rotationCount: 1,
    waveSpeed: 1,
    waveSpread: 0.3,
    waveEasing: "easeInOutElastic",
    wave: {
      mode: "linear" as const,
      directionX: -1,
      directionY: -1
    }
  },
  color: {
    opacityFactor: 1.5,
    fillAlphaStart: 240,
    fillAlphaEnd: 0,
    strokeAlpha: 200,
    hueMultiplier: 2
  },
  backgroundColor: [
    246,
    235,
    225
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      text: {
        label: "Text",
        component: "text"
      },
      font: {
        component: "select",
        label: "Font name",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      size: {
        label: "Size",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      depth: {
        label: "Depth",
        component: "slider",
        min: 1,
        max: 100,
        step: 1
      },
      columns: {
        label: "Grid columns",
        component: "slider",
        min: 10,
        max: 150,
        step: 1
      },
      sampleFactor: {
        label: "Text sample factor",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01
      },
      simplifyThreshold: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      }
    }
  },
  mask: {
    component: "nested-object",
    label: "Mask",
    fields: {
      distance: {
        label: "Distance threshold",
        component: "slider",
        min: 0.001,
        max: 0.1,
        step: 0.001
      }
    }
  },
  animation: {
    component: "nested-object",
    label: "Animation",
    fields: {
      variableDepth: {
        label: "Variable depth",
        component: "checkbox"
      },
      rotate: {
        label: "Rotate",
        component: "checkbox"
      },
      rotationCount: {
        label: "Rotation count",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.5
      },
      waveSpeed: {
        label: "Wave speed",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.5
      },
      waveSpread: {
        label: "Wave spread",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      waveEasing: {
        component: "easing",
        label: "Wave easing"
      },
      wave: {
        label: "Wave Configuration",
        component: "conditional-group",
        conditionalOn: "mode",
        typeSelector: {
          options: [
            {
              label: "Linear",
              value: "linear"
            },
            {
              label: "Radial",
              value: "radial"
            },
            {
              label: "Interactive",
              value: "interactive"
            }
          ]
        },
        configs: {
          linear: {
            directionX: {
              label: "Direction X",
              component: "slider",
              min: -1,
              max: 1,
              step: 0.1
            },
            directionY: {
              label: "Direction Y",
              component: "slider",
              min: -1,
              max: 1,
              step: 0.1
            }
          },
          radial: {
            fromCenter: {
              label: "From center (vs edges)",
              component: "checkbox"
            },
            radialRotation: {
              label: "Rotate toward direction",
              component: "checkbox"
            }
          },
          interactive: {
            useMouse: {
              label: "Use mouse (vs animated)",
              component: "checkbox"
            },
            sensitivity: {
              label: "Sensitivity (lower = wider impact)",
              component: "slider",
              min: 0.1,
              max: 2,
              step: 0.05
            },
            sinMultiplier: {
              label: "Sin multiplier (animated)",
              component: "slider",
              min: 1,
              max: 9,
              step: 0.1
            },
            cosMultiplier: {
              label: "Cos multiplier (animated)",
              component: "slider",
              min: 1,
              max: 9,
              step: 0.1
            }
          }
        }
        // Schema is injected client-side in injectSketchSchemas.ts
        // See schemas.ts for WaveConfigSchema definition
      }
    }
  },
  color: {
    component: "nested-object",
    label: "Color",
    fields: {
      opacityFactor: {
        label: "Opacity factor",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.1
      },
      fillAlphaStart: {
        label: "Fill alpha (visible)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      fillAlphaEnd: {
        label: "Fill alpha (hidden)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      strokeAlpha: {
        label: "Stroke alpha",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      hueMultiplier: {
        label: "Hue range multiplier",
        component: "slider",
        min: 0.5,
        max: 5,
        step: 0.1
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
