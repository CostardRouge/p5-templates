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
    speed: 1
  },
  shape: {
    text: "#*test-abc-123!",
    font: "serif",
    size: 1.11,
    sampleFactor: 0.5,
    simplifyThreshold: 0,
    morphSpeed: 1.5
  },
  grid: {
    proportional: true,
    columns: 47,
    rows: 50
  },
  cell: {
    chanceThreshold: 0.5,
    circleSize: 20,
    boxSize: 15,
    boxDepth: 75
  },
  noise: {
    gateEnabled: true,
    thresholdW: 0.15,
    thresholdH: 0.15
  },
  sceneRotation: {
    enabled: true,
    amount: Math.PI / 12,
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
        label: "Word cycles / loop (snaps to whole cycles/loop)",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      }
    }
  },
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
        label: "Chance threshold (circle vs box)",
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
      boxSize: {
        label: "Box size",
        component: "slider",
        min: 1,
        max: 80,
        step: 1
      },
      boxDepth: {
        label: "Box depth (Z)",
        component: "slider",
        min: 0,
        max: 1000,
        step: 1
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
      thresholdW: {
        label: "Threshold W",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      thresholdH: {
        label: "Threshold H",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
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
        label: "Max angle",
        component: "slider",
        min: 0,
        max: Math.PI / 2,
        step: 0.01
      },
      speed: {
        label: "Speed (snaps to whole turns/loop)",
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
        label: "Hue offset speed (snaps to whole turns/loop)",
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
