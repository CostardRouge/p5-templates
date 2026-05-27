import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  shape: {
    text: "*+",
    font: "serif",
    size: 0.88,
    sampleFactor: 0.5,
    simplifyThreshold: 0
  },
  morph: {
    speed: 1,
    easing: "easeInOutExpo"
  },
  flower: {
    petals: 7,
    size: 40,
    positionScale: 2,
    rotationSpeed: 1,
    rotationPerPoint: 7,
    keepSize: false
  },
  grid: {
    show: false,
    columns: 10,
    rows: 10,
    depth: -120
  },
  color: {
    palette: "rainbow",
    hueMultiplier: 1,
    hueOffsetSpeed: 1,
    opacityMin: 1,
    opacityMax: 3,
    opacityFrequency: 100,
    opacitySpeed: 5
  },
  strokeWeight: 2,
  backgroundColor: [
    0,
    0,
    0
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
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
        label: "Letters to morph",
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
        label: "Size (relative to canvas width)",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.01
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
  morph: {
    component: "nested-object",
    label: "Morphing",
    fields: {
      speed: {
        label: "Morph speed (full loops)",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      },
      easing: {
        label: "Morph easing",
        component: "easing"
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
      size: {
        label: "Petal size",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      positionScale: {
        label: "Point spread scale",
        component: "slider",
        min: 0.5,
        max: 4,
        step: 0.05
      },
      rotationSpeed: {
        label: "Global rotation speed",
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
  grid: {
    component: "nested-object",
    label: "Background grid",
    fields: {
      show: {
        label: "Show grid?",
        component: "checkbox"
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 50,
        step: 1
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 50,
        step: 1
      },
      depth: {
        label: "Depth (Z)",
        component: "slider",
        min: -1000,
        max: 0,
        step: 5
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
      hueMultiplier: {
        label: "Hue multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      hueOffsetSpeed: {
        label: "Hue offset speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      opacityMin: {
        label: "Opacity min",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      opacityFrequency: {
        label: "Opacity wave frequency",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      opacitySpeed: {
        label: "Opacity wave speed",
        component: "slider",
        min: -20,
        max: 20,
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
  },
  title: titleFormConfiguration
};
