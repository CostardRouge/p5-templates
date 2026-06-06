import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  mask: {
    distance: 1
  },
  shape: {
    text: "#sans",
    fontA: "sans",
    fontB: "serif",
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
    boxSize: 34,
    boxDepth: 1000,
    showFrontCircle: true,
    frontCircleChance: 0.5,
    frontCircleSize: 18
  },
  sceneRotation: {
    enabled: true,
    amount: Math.PI / 6,
    speed: 1,
    microSpeedX: 1,
    microSpeedY: 2,
    microDivisorX: 12,
    microDivisorY: 12
  },
  color: {
    palette: "rainbow",
    hueOffsetSpeed: 2,
    hueIndexMultiplier: 16
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

const fontOptionList = fontNames.map( ( name ) => ( {
  value: name,
  label: name
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
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      text: {
        label: "Letters",
        component: "text"
      },
      fontA: {
        component: "select",
        label: "Font A",
        options: fontOptionList
      },
      fontB: {
        component: "select",
        label: "Font B (cell mix)",
        options: fontOptionList
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
    label: "Cells (deep boxes)",
    fields: {
      boxSize: {
        label: "Box width/height",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      boxDepth: {
        label: "Box depth (Z extrusion)",
        component: "slider",
        min: 10,
        max: 5000,
        step: 10
      },
      showFrontCircle: {
        label: "Show front-face circle",
        component: "checkbox"
      },
      frontCircleChance: {
        label: "Front circle chance threshold",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      frontCircleSize: {
        label: "Front circle size",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
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
      },
      hueIndexMultiplier: {
        label: "Hue index multiplier",
        component: "slider",
        min: 0,
        max: 32,
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
