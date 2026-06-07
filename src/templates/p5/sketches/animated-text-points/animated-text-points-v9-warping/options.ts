import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  mask: {
    distance: 0.55
  },
  letters: {
    speed: 1,
    spatialFactor: 0
  },
  shape: {
    text: " warp",
    font: "martian",
    size: 1.01,
    sampleFactor: 0.15,
    simplifyThreshold: 0
  },
  grid: {
    proportional: true,
    columns: 43,
    rows: 60
  },
  cell: {
    boxSize: 27,
    boxDepth: 397
  },
  warp: {
    amount: 0.11,
    rowDivisor: 1,
    colDivisor: 2,
    speed: 3
  },
  color: {
    palette: "rainbow",
    useNormalMaterial: false,
    hueIndexMultiplier: 6,
    hueOffset: 0,
    opacityMax: 2.1,
    opacityMin: 1
  },
  strokeWeight: 0,
  backgroundColor: [
    0,
    0,
    0,
    255
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
    label: "Cells (boxes)",
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
      }
    }
  },
  warp: {
    component: "nested-object",
    label: "Per-cell warp",
    fields: {
      amount: {
        label: "Amount (fraction of PI)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      rowDivisor: {
        label: "Row divisor",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.5
      },
      colDivisor: {
        label: "Col divisor",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.5
      },
      speed: {
        label: "Warp speed",
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
      palette: {
        component: "select",
        label: "Palette",
        options: paletteOptions
      },
      useNormalMaterial: {
        label: "Use normal material",
        component: "checkbox"
      },
      hueIndexMultiplier: {
        label: "Hue multiplier",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      hueOffset: {
        label: "Hue offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
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
