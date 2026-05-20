import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "2",
    font: "serif",
    size: 0.5,
    columns: 100,
    positionScale: 2,
    sampleFactor: 0.1,
    simplifyThreshold: 0
  },
  mask: {
    distance: 0.025
  },
  animation: {
    rotateAngle: Math.PI / 4
  },
  color: {
    hueMultiplier: 3,
    opacityFactor: 1.5,
    fillAlpha: 176
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
      positionScale: {
        label: "Cube spread (× position)",
        component: "slider",
        min: 0.5,
        max: 4,
        step: 0.1
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
      rotateAngle: {
        label: "Per-cube rotation amplitude",
        component: "slider",
        min: 0,
        max: Math.PI,
        step: 0.05
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
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
