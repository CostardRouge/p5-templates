import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  mask: {
    distance: 1
  },
  letters: {
    speed: 1,
    spatialFactor: 0
  },
  shape: {
    text: "Turbulence ",
    font: "serif",
    letterSize: 870,
    sampleFactor: 0.13,
    simplifyThreshold: 0
  },
  grid: {
    proportional: true,
    columns: 46,
    rows: 50
  },
  cell: {
    boxSize: 23,
    boxDepth: 263,
    screenRatio: 1.55
  },
  warp: {
    amount: 0.03,
    innerAmount: 0,
    rowDivisorA: 6,
    colDivisorA: 17.5,
    rowDivisorB: 20,
    colDivisorB: 22.5,
    speed: 1
  },
  color: {
    useNormalMaterial: true,
    palette: "rainbow",
    hueIndexMultiplier: 4,
    opacityMax: 2.1,
    opacityMin: 1
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
  mask: {
    component: "nested-object",
    label: "Mask (gridMask)",
    fields: {
      distance: {
        label: "Mask radius (× cell size)",
        component: "slider",
        min: 0.1,
        max: 5,
        step: 0.05
      }
    }
  },
  letters: {
    component: "nested-object",
    label: "Letters",
    fields: {
      speed: {
        label: "Word cycles / loop",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      },
      spatialFactor: {
        label: "Spatial scramble (0 = single letter)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.05
      }
    }
  },
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      text: {
        label: "Word",
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
      letterSize: {
        label: "Letter size (px)",
        component: "slider",
        min: 100,
        max: 3000,
        step: 10
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
    label: "Cells",
    fields: {
      boxSize: {
        label: "Box size",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      boxDepth: {
        label: "Box depth",
        component: "slider",
        min: 1,
        max: 1000,
        step: 1
      },
      screenRatio: {
        label: "Screen ratio (y stretch)",
        component: "slider",
        min: 0.5,
        max: 3,
        step: 0.05
      }
    }
  },
  warp: {
    component: "nested-object",
    label: "Dual warp",
    fields: {
      amount: {
        label: "Outer amount",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      innerAmount: {
        label: "Inner amount",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      rowDivisorA: {
        label: "Outer row divisor",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.5
      },
      colDivisorA: {
        label: "Outer col divisor",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.5
      },
      rowDivisorB: {
        label: "Inner row divisor",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.5
      },
      colDivisorB: {
        label: "Inner col divisor",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.5
      },
      speed: {
        label: "Speed",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
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
        label: "Palette",
        options: paletteOptions
      },
      hueIndexMultiplier: {
        label: "Hue multiplier",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      opacityMin: {
        label: "Opacity min",
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
  },
  title: titleFormConfiguration
};
