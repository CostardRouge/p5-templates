import easing from "@/p5/utils/easing";

export const formValues = {
  text: {
    from: "a",
    to: "z",
    font: "martian",
    size: 1,
    sampleFactor: 0.1,
    simplifyThreshold: 0,
  },
  shape: {
    depth: {
      direction: -1,
      length: 1
    },
    strokeWeight: {
      min: 3,
      max: 30,
    },
    colorFunction: "rainbow",
    progression: {
      display: true,
      margin: 100,
    },
  },
  animation: {
    interactive: true,
    easing: "",
  },
  backgroundColor: [
    246,
    235,
    225
  ],
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      text: {
        label: "Text",
        component: "text",
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
      },
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
      },
    }
  },
  animation: {
    component: "nested-object",
    label: "Animation",
    fields: {
      variableDepth: {
        label: "Variable depth",
        component: "checkbox",
      },
      rotate: {
        label: "Rotate",
        component: "checkbox",
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
        component: "select",
        label: "Wave easing",
        options: Object.keys( easing ).map( easingFunctionName => ( {
          label: easingFunctionName,
          value: easingFunctionName,
        } ) )
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
            },
          },
          radial: {
            fromCenter: {
              label: "From center (vs edges)",
              component: "checkbox",
            },
            radialRotation: {
              label: "Rotate toward direction",
              component: "checkbox",
            },
          },
          interactive: {
            useMouse: {
              label: "Use mouse (vs animated)",
              component: "checkbox",
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
            },
          }
        },
        // Schema is injected client-side in injectSketchSchemas.ts
        // See schemas.ts for WaveConfigSchema definition
      },
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
      },
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
};
