import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "*",
    font: "onlysansVariable",
    size: 0.93,
    sampleFactor: 0.38,
    simplifyThreshold: 0
  },
  flower: {
    petals: 2,
    positionScale: 2.05,
    sizeMin: 0,
    sizeMax: 41,
    sizeFrequency: 0.25,
    rotationSpeed: 1,
    rotationPerPoint: 20,
    keepSize: false
  },
  color: {
    palette: "test",
    hueEasing: "easeInCubic",
    hueMultiplier: 1,
    opacitySinSpeed: 4,
    opacitySinFreq: 50,
    opacityCosSpeed: 2,
    opacityMaxMax: 5,
    opacityMaxMin: 1
  },
  strokeWeight: 20,
  backgroundColor: [
    0,
    0,
    0
  ]
};

const paletteOptions = [
  "rainbow",
  "rainbowCrazy",
  "test",
  "darkBlueYellow",
  "purple",
  "purpleSimple",
  "green",
  "black"
].map( ( value ) => ( {
  value,
  label: value
} ) );

export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      text: {
        label: "Symbol",
        component: "text"
      },
      font: {
        component: "select",
        label: "Font",
        options: fontNames.map( ( name ) => ( {
          value: name,
          label: name
        } ) )
      },
      size: {
        label: "Size (relative)",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.01
      },
      sampleFactor: {
        label: "Sample factor",
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
  flower: {
    component: "nested-object",
    label: "Flower",
    fields: {
      petals: {
        label: "Petals",
        component: "slider",
        min: 2,
        max: 24,
        step: 1
      },
      positionScale: {
        label: "Point spread scale",
        component: "slider",
        min: 0.5,
        max: 4,
        step: 0.05
      },
      sizeMin: {
        label: "Pulse size min",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      sizeMax: {
        label: "Pulse size max",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      sizeFrequency: {
        label: "Pulse frequency",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.05
      },
      rotationSpeed: {
        label: "Rotation speed",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      },
      rotationPerPoint: {
        label: "Rotation per point",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      keepSize: {
        label: "Keep petal size constant?",
        component: "checkbox"
      }
    }
  },
  color: {
    component: "nested-object",
    label: "Color",
    fields: {
      palette: {
        component: "select",
        label: "Palette",
        options: paletteOptions
      },
      hueEasing: {
        component: "easing",
        label: "Hue easing"
      },
      hueMultiplier: {
        label: "Hue multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      opacitySinSpeed: {
        label: "Opacity sin speed",
        component: "slider",
        min: -20,
        max: 20,
        step: 0.1
      },
      opacitySinFreq: {
        label: "Opacity sin freq",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      opacityCosSpeed: {
        label: "Opacity max speed",
        component: "slider",
        min: -20,
        max: 20,
        step: 0.1
      },
      opacityMaxMax: {
        label: "Opacity max-max",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      opacityMaxMin: {
        label: "Opacity max-min",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      }
    }
  },
  strokeWeight: {
    label: "Stroke weight",
    component: "slider",
    min: 0,
    max: 20,
    step: 0.5
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
