import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "xyz",
    font: "waverseVariable",
    size: 1.1,
    sampleFactor: 0.23,
    simplifyThreshold: 0,
    morphSpeed: 2
  },
  grid: {
    proportional: true,
    columns: 54,
    rows: 75
  },
  dot: {
    size: 17,
    distanceThreshold: 0.041
  },
  color: {
    palette: "purpleSimple",
    hueOffsetSpeed: 0,
    hueMultiplier: 0,
    opacityFactor: 1
  },
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
        label: "Morph speed (full loops)",
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
  dot: {
    component: "nested-object",
    label: "Dot",
    fields: {
      size: {
        label: "Dot size",
        component: "slider",
        min: 1,
        max: 80,
        step: 1
      },
      distanceThreshold: {
        label: "Distance threshold (relative)",
        component: "slider",
        min: 0.005,
        max: 0.2,
        step: 0.001
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
      hueMultiplier: {
        label: "Hue multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      opacityFactor: {
        label: "Opacity factor",
        component: "slider",
        min: 0.1,
        max: 5,
        step: 0.1
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
