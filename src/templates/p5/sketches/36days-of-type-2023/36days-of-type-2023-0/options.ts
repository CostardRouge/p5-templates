import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "0",
    font: "sans",
    sizeFactor: 1,
    sampleFactor: 0.25,
    simplifyThreshold: 0
  },
  cylinder: {
    count: 50,
    radiusFactor: 1,
    strokeWeight: 6
  },
  animation: {
    rotateYSpeed: 4,
    rotateYEasing: "easeInOutCubic",
    rotateXSpeed: 2,
    rotateXEasing: "easeInOutCubic",
    rotateZEnabled: true,
    rotateZSpeed: 1
  },
  wave: {
    xDivisor: 4,
    yDivisor: 40,
    speedMultiplier: 8,
    progressionMultiplier: 6
  },
  color: {
    hueMultiplier: 4,
    hueOffsetSpeed: 1,
    opacityMin: 1,
    darkness: 25,
    opacityThreshold: 10
  },
  backgroundColor: [
    0,
    0,
    0
  ]
};

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
      sizeFactor: {
        label: "Size factor",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.05
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
  cylinder: {
    component: "nested-object",
    label: "Cylinder",
    fields: {
      count: {
        label: "Letter count around cylinder",
        component: "slider",
        min: 10,
        max: 200,
        step: 1
      },
      radiusFactor: {
        label: "Radius factor",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.05
      },
      strokeWeight: {
        label: "Point stroke weight",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      }
    }
  },
  animation: {
    component: "nested-object",
    label: "Animation",
    fields: {
      rotateYSpeed: {
        label: "Rotate Y speed",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.5
      },
      rotateYEasing: {
        component: "easing",
        label: "Rotate Y easing"
      },
      rotateXSpeed: {
        label: "Rotate X speed",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.5
      },
      rotateXEasing: {
        component: "easing",
        label: "Rotate X easing"
      },
      rotateZEnabled: {
        label: "Rotate Z enabled",
        component: "checkbox"
      },
      rotateZSpeed: {
        label: "Rotate Z speed",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.1
      }
    }
  },
  wave: {
    component: "nested-object",
    label: "Wave",
    fields: {
      xDivisor: {
        label: "X divisor (lower = wider waves)",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.1
      },
      yDivisor: {
        label: "Y divisor (lower = wider waves)",
        component: "slider",
        min: 0.5,
        max: 100,
        step: 0.5
      },
      speedMultiplier: {
        label: "Speed multiplier",
        component: "slider",
        min: 0,
        max: 24,
        step: 0.1
      },
      progressionMultiplier: {
        label: "Progression multiplier",
        component: "slider",
        min: 0,
        max: 24,
        step: 0.1
      }
    }
  },
  color: {
    component: "nested-object",
    label: "Color",
    fields: {
      hueMultiplier: {
        label: "Hue range multiplier",
        component: "slider",
        min: 0.5,
        max: 10,
        step: 0.1
      },
      hueOffsetSpeed: {
        label: "Hue offset speed",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.1
      },
      opacityMin: {
        label: "Opacity floor",
        component: "slider",
        min: 0,
        max: 100,
        step: 1
      },
      darkness: {
        label: "Darkness ceiling",
        component: "slider",
        min: 1,
        max: 100,
        step: 1
      },
      opacityThreshold: {
        label: "Opacity threshold (draws below)",
        component: "slider",
        min: 1,
        max: 100,
        step: 1
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
