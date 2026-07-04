import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  mask: {
    distance: 1
  },
  letters: {
    speed: 1,
    spatialFactor: 0
  },
  shape: {
    text: "2+2=??",
    font: "serif",
    size: 1.11,
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
    circleSize: 20,
    sphereSize: 30
  },
  wobble: {
    amplitude: 50,
    circleSpeed: 1,
    sphereSpeed: 5,
    rowMultiplier: 10
  },
  sceneRotation: {
    enabled: true,
    amount: Math.PI / 6,
    speed: 1,
    tiltX: Math.PI / 6
  },
  color: {
    palette: "rainbow",
    hueOffsetSpeed: 1
  },
  strokeWeight: 2,
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
        label: "Letters (per-cell mix)",
        component: "text"
      },
      font: {
        component: "select",
        label: "Font",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      size: {
        label: "Size (relative to canvas)",
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
        label: "Chance threshold",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      circleSize: {
        label: "Circle size",
        component: "slider",
        min: 1,
        max: 80,
        step: 1
      },
      sphereSize: {
        label: "Sphere size",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      }
    }
  },
  wobble: {
    component: "nested-object",
    label: "Z wobble",
    fields: {
      amplitude: {
        label: "Amplitude",
        component: "slider",
        min: 0,
        max: 500,
        step: 1
      },
      circleSpeed: {
        label: "Circle speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      sphereSpeed: {
        label: "Sphere speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      rowMultiplier: {
        label: "Row multiplier",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.1
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
        label: "Speed",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      },
      tiltX: {
        label: "Fixed X tilt",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
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
  }
};
