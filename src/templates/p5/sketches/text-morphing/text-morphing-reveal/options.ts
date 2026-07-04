import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

// Default values only — exposed at runtime as `options.sketch.*`
export const formValues = {
  text: {
    words: "HOW?\nLIKE\nTHIS",
    font: "martian",
    size: 0.22,
    sampleFactor: 0.4,
    verticalPosition: 0.5
  },

  morphing: {
    hold: 0.4,
    easing: "easeInOutCubic",
    scatter: 0.93,
    scatterCurl: 0.7
  },

  points: {
    colorMode: "rainbow",
    color: [
      255,
      255,
      255
    ],
    strokeWeight: 4,
    glow: 6
  },

  backgroundColor: [
    0,
    0,
    0
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  text: {
    component: "nested-object",
    label: "Text",
    initialExpanded: true,
    fields: {
      words: {
        component: "text",
        label: "Words (one per line, morphs in order)"
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
        component: "slider",
        label: "Size (× canvas width)",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      sampleFactor: {
        component: "slider",
        label: "Point density",
        min: 0.02,
        max: 1,
        step: 0.01
      },
      verticalPosition: {
        component: "slider",
        label: "Vertical position",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },

  morphing: {
    component: "nested-object",
    label: "Morphing",
    initialExpanded: true,
    fields: {
      hold: {
        component: "slider",
        label: "Hold (readable share of each step)",
        min: 0,
        max: 0.95,
        step: 0.05
      },
      easing: {
        component: "easing",
        label: "Morph easing"
      },
      scatter: {
        component: "slider",
        label: "Mid-morph scatter (× canvas width)",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      scatterCurl: {
        component: "slider",
        label: "Scatter curl",
        min: 0,
        max: 4,
        step: 0.05
      }
    }
  },

  points: {
    component: "nested-object",
    label: "Points",
    fields: {
      colorMode: {
        component: "select",
        label: "Color mode",
        options: [
          {
            label: "Rainbow",
            value: "rainbow"
          },
          {
            label: "Single color",
            value: "mono"
          }
        ]
      },
      color: {
        component: "color",
        label: "Point color (single color mode)"
      },
      strokeWeight: {
        component: "slider",
        label: "Point size",
        min: 1,
        max: 60,
        step: 1
      },
      glow: {
        component: "slider",
        label: "Glow",
        min: 0,
        max: 120,
        step: 2
      }
    }
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
