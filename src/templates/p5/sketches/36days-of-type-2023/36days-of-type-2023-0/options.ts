import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "0",
    font: "sans",
    sampleFactor: 0.25,
    simplifyThreshold: 0
  },
  cylinder: {
    count: 50,
    strokeWeight: 6
  },
  color: {
    hueMultiplier: 4,
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
      strokeWeight: {
        label: "Point stroke weight",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
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
