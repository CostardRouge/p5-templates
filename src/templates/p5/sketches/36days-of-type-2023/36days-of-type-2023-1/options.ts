import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "1",
    font: "martian",
    size: 0.75,
    columns: 50,
    sampleFactor: 0.1,
    simplifyThreshold: 0,
    depthMin: 20,
    depthMax: 500,
    noiseScale: 10
  },
  mask: {
    distance: 0.025
  },
  color: {
    hueMultiplier: 3,
    opacityFactor: 1.5,
    fillAlpha: 210
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
        max: 200,
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
      depthMin: {
        label: "Depth min",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      },
      depthMax: {
        label: "Depth max",
        component: "slider",
        min: 50,
        max: 1500,
        step: 10
      },
      noiseScale: {
        label: "Noise scale",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.5
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
