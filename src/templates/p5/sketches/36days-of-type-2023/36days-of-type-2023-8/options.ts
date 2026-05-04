import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "8",
    font: "martian",
    depth: 20,
    size: 1,
    columns: 65,
    sampleFactor: 0.1,
    simplifyThreshold: 0
  },
  interactive: {
    enabled: true,
    mouse: false,
    sensitivityMultiplier: 0.3,
    sinMultiplier: 3,
    cosMultiplier: 1
  },
  mask: {
    distance: 0.015
  },
  animation: {
    rotate: false,
    rotationCount: 2,
    switchSpeed: 2,
    switchIndexDivisor: 5,
    positionInfluence: 100
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
  interactive: {
    component: "nested-object",
    label: "Interactive",
    fields: {
      enabled: {
        label: "Enabled",
        component: "checkbox"
      },
      mouse: {
        label: "With mouse?",
        component: "checkbox"
      },
      sensitivityMultiplier: {
        label: "sensitivityMultiplier",
        component: "slider",
        min: 0.1,
        max: 1,
        step: 0.01
      },
      sinMultiplier: {
        label: "sinMultiplier",
        component: "slider",
        min: 1,
        max: 9,
        step: 0.1
      },
      cosMultiplier: {
        label: "cosMultiplier",
        component: "slider",
        min: 1,
        max: 9,
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
      switchSpeed: {
        label: "Layer switch speed",
        component: "slider",
        min: 0.5,
        max: 10,
        step: 0.5
      },
      switchIndexDivisor: {
        label: "Switch index divisor",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      positionInfluence: {
        label: "Position influence",
        component: "slider",
        min: 10,
        max: 500,
        step: 10
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
