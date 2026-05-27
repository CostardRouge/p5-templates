import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  shape: {
    text: "#test!",
    font: "serif",
    size: 1.11,
    sampleFactor: 0.5,
    simplifyThreshold: 0,
    morphSpeed: 1
  },
  grid: {
    proportional: true,
    columns: 30,
    rows: 50
  },
  cell: {
    chanceThreshold: 0.5,
    sphereSize: 30,
    crossSize: 40,
    crossColor: [
      32,
      32,
      255
    ]
  },
  noise: {
    gateEnabled: true,
    speedW: 2,
    speedH: -1,
    thresholdW: 0.2,
    thresholdH: 0.25
  },
  wobble: {
    amplitude: 100,
    speed: 5,
    rowMultiplier: 4
  },
  sceneRotation: {
    enabled: true,
    amount: Math.PI / 6,
    speed: 1.5
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
        label: "Font",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
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
      },
      morphSpeed: {
        label: "Morph speed",
        component: "slider",
        min: 0.1,
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
        label: "Chance threshold (cross vs sphere)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      sphereSize: {
        label: "Sphere size",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      crossSize: {
        label: "Cross size",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      crossColor: {
        label: "Cross color",
        component: "color"
      }
    }
  },
  noise: {
    component: "nested-object",
    label: "Empty-cell noise gate",
    fields: {
      gateEnabled: {
        label: "Enable noise gate",
        component: "checkbox"
      },
      speedW: {
        label: "W noise speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      speedH: {
        label: "H noise speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      thresholdW: {
        label: "W threshold",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      thresholdH: {
        label: "H threshold",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  wobble: {
    component: "nested-object",
    label: "Sphere Z wobble",
    fields: {
      amplitude: {
        label: "Amplitude",
        component: "slider",
        min: 0,
        max: 500,
        step: 1
      },
      speed: {
        label: "Speed",
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
  },
  title: titleFormConfiguration
};
