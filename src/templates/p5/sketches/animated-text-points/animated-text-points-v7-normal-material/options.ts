import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  shape: {
    text: "abcdefgh",
    font: "sans",
    size: 0.74,
    sampleFactor: 0.5,
    simplifyThreshold: 0
  },
  grid: {
    proportional: true,
    columns: 30,
    rows: 50
  },
  cell: {
    chanceThreshold: 0.5,
    crossSize: 33,
    boxSize: 33,
    boxDepth: 10000
  },
  sceneRotation: {
    enabled: true,
    amount: Math.PI / 6,
    speed: 1.5,
    microSpeedX: 1,
    microSpeedY: 0.5,
    microDivisorX: 12,
    microDivisorY: 12
  },
  color: {
    useNormalMaterial: true,
    palette: "rainbow",
    hueOffsetSpeed: 5
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
        label: "Letters",
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
  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      proportional: {
        label: "Proportional rows?",
        component: "checkbox"
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 120,
        step: 1
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      }
    }
  },
  cell: {
    component: "nested-object",
    label: "Cell shapes",
    fields: {
      chanceThreshold: {
        label: "Cross vs Box chance",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      crossSize: {
        label: "Cross size",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      boxSize: {
        label: "Box size",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      boxDepth: {
        label: "Box depth (deep into screen)",
        component: "slider",
        min: 100,
        max: 20000,
        step: 100
      }
    }
  },
  sceneRotation: {
    component: "nested-object",
    label: "Scene rotation",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox"
      },
      amount: {
        label: "Max Y angle",
        component: "slider",
        min: 0,
        max: Math.PI,
        step: 0.01
      },
      speed: {
        label: "Y speed",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      },
      microSpeedX: {
        label: "Micro X speed",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      },
      microSpeedY: {
        label: "Micro Y speed",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      },
      microDivisorX: {
        label: "Micro X divisor",
        component: "slider",
        min: 1,
        max: 50,
        step: 1
      },
      microDivisorY: {
        label: "Micro Y divisor",
        component: "slider",
        min: 1,
        max: 50,
        step: 1
      }
    }
  },
  color: {
    component: "nested-object",
    label: "Color",
    fields: {
      useNormalMaterial: {
        label: "Use normal material",
        component: "checkbox"
      },
      palette: {
        component: "select",
        label: "Palette (stroke fallback)",
        options: paletteOptions
      },
      hueOffsetSpeed: {
        label: "Hue offset speed",
        component: "slider",
        min: -10,
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
  },
  title: titleFormConfiguration
};
