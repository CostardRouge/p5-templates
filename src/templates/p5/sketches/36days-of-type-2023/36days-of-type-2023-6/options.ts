import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "6",
    font: "martian",
    size: 0.75,
    columns: 42,
    sampleFactor: 0.06,
    simplifyThreshold: 0
  },
  mask: {
    distance: 0.025
  },
  color: {
    hueMultiplier: 1,
    fillAlpha: 230
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
        label: "Grid columns (per face)",
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
        min: 0.1,
        max: 5,
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
