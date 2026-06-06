import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "3",
    font: "waverseVariable",
    size: 1.3,
    columns: 44,
    depth: 60,
    sampleFactor: 0.1,
    simplifyThreshold: 0
  },
  mask: {
    distance: 0.024
  },
  animation: {
    swapSpeed: 1,
    stagger: 0.5,
    rotateAngle: 0.2
  },
  camera: {
    pullback: 200
  },
  color: {
    hueMultiplier: 2.2,
    opacityFactor: 1.5,
    fillAlpha: 225,
    strokeAlpha: 100
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
      size: {
        label: "Size (× width)",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.05
      },
      columns: {
        label: "Grid columns",
        component: "slider",
        min: 10,
        max: 300,
        step: 1
      },
      depth: {
        label: "Box depth",
        component: "slider",
        min: 1,
        max: 500,
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
      swapSpeed: {
        label: "Swap speed (cycles per loop)",
        component: "slider",
        min: 0.25,
        max: 5,
        step: 0.25
      },
      stagger: {
        label: "Per-point stagger",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      rotateAngle: {
        label: "Per-cube rotateX amplitude",
        component: "slider",
        min: 0,
        max: Math.PI,
        step: 0.05
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      pullback: {
        label: "Z pullback (-translate)",
        component: "slider",
        min: 0,
        max: 2000,
        step: 10
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
      opacityFactor: {
        label: "Opacity factor",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.1
      },
      fillAlpha: {
        label: "Fill alpha",
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
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
