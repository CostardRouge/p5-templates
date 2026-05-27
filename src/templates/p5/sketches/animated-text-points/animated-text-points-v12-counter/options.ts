import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  shape: {
    text: "0123456789 ",
    font: "sans",
    letterSize: 1000,
    sampleFactor: 0.15,
    simplifyThreshold: 0
  },
  grid: {
    proportional: true,
    columns: 30,
    rows: 50
  },
  cell: {
    boxSize: 36,
    boxDepth: 150,
    screenRatio: 1.5,
    microRotAmount: 0.16,
    ringRotMultiplier: 2
  },
  bgPattern: {
    enabled: true,
    weight: 3,
    easing: "easeInOutExpo",
    color: [
      255,
      255,
      255
    ]
  },
  color: {
    palette: "rainbow",
    hueIndexMultiplier: 4,
    opacityMax: 2.1,
    opacityMin: 1,
    fillAlpha: 230
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
        label: "Counter digits",
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
        label: "Letter size (absolute px)",
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
      },
      microRotAmount: {
        label: "Micro rotation amount",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      ringRotMultiplier: {
        label: "Ring rotation multiplier",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      }
    }
  },
  bgPattern: {
    component: "nested-object",
    label: "Background pattern",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox"
      },
      weight: {
        label: "Line weight",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.5
      },
      easing: {
        component: "easing",
        label: "Counter easing"
      },
      color: {
        component: "color",
        label: "Line color"
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
      },
      fillAlpha: {
        label: "Fill alpha",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
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
