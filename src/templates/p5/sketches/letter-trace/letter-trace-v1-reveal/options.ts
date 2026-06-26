import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  text: {
    value: "TRACE",
    font: "sans",
    size: 0.2,
    sampleFactor: 0.15,
    simplifyThreshold: 0,
    contourBreak: 0.18,
    spacing: 0.012
  },
  draw: {
    drawers: 3,
    // "sequential" starts each outline at its seam; "chaotic" scatters the start
    // points so the outlines fill in from random places.
    start: "chaotic" as "sequential" | "chaotic",
    // All letters reveal together, or stagger left → right across the word.
    simultaneous: false,
    letterStagger: 0.5,
    easing: "easeInOutCubic"
  },
  camera: {
    zoomDrift: 0.04
  },
  stroke: {
    weight: 3,
    color: [
      255,
      255,
      255
    ] as number[],
    rainbow: true,
    palette: "rainbow",
    hueSpread: 0.6,
    hueSpeed: 0,
    hueOffset: 0
  },
  fill: {
    mode: "none" as "none" | "onComplete" | "always",
    color: [
      255,
      255,
      255
    ] as number[],
    alpha: 40
  },
  loop: {
    assemble: 0.45,
    hold: 0.25
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  text: {
    label: "Text",
    component: "nested-object",
    fields: {
      value: {
        label: "Text",
        component: "text"
      },
      font: {
        label: "Font",
        component: "select",
        options: fontSelectOptions
      },
      size: {
        label: "Size (× smallest canvas side)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      sampleFactor: {
        label: "Outline precision (sample factor)",
        component: "slider",
        min: 0.02,
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
      contourBreak: {
        label: "Contour break distance (× size)",
        component: "slider",
        min: 0.05,
        max: 0.5,
        step: 0.01
      },
      spacing: {
        label: "Pen step (× size)",
        component: "slider",
        min: 0.004,
        max: 0.04,
        step: 0.002
      }
    }
  },
  draw: {
    label: "Drawing",
    component: "nested-object",
    fields: {
      drawers: {
        label: "Pens per outline",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      start: {
        label: "Start points",
        component: "select",
        options: [
          {
            label: "Sequential (from the seam)",
            value: "sequential"
          },
          {
            label: "Chaotic (scattered)",
            value: "chaotic"
          }
        ]
      },
      simultaneous: {
        label: "All letters at once?",
        component: "checkbox"
      },
      letterStagger: {
        label: "Letter stagger (left → right)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      easing: {
        label: "Reveal easing",
        component: "easing"
      }
    }
  },
  camera: {
    label: "Camera",
    component: "nested-object",
    fields: {
      zoomDrift: {
        label: "Zoom drift",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.01
      }
    }
  },
  stroke: {
    label: "Stroke",
    component: "nested-object",
    fields: {
      weight: {
        label: "Weight",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.5
      },
      color: {
        label: "Color (when not rainbow)",
        component: "color"
      },
      rainbow: {
        label: "Rainbow stroke?",
        component: "checkbox"
      },
      palette: {
        label: "Palette",
        component: "select",
        options: [
          {
            label: "Rainbow",
            value: "rainbow"
          },
          {
            label: "Rainbow (crazy)",
            value: "rainbowCrazy"
          },
          {
            label: "Dark blue / yellow",
            value: "darkBlueYellow"
          },
          {
            label: "Purple",
            value: "purple"
          }
        ]
      },
      hueSpread: {
        label: "Hue spread (per drawer)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.1
      },
      hueSpeed: {
        label: "Hue speed (over time)",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.1
      },
      hueOffset: {
        label: "Hue offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      }
    }
  },
  fill: {
    label: "Letter fill",
    component: "nested-object",
    fields: {
      mode: {
        label: "Fill mode",
        component: "select",
        options: [
          {
            label: "None",
            value: "none"
          },
          {
            label: "On completion",
            value: "onComplete"
          },
          {
            label: "Always",
            value: "always"
          }
        ]
      },
      color: {
        label: "Fill color",
        component: "color"
      },
      alpha: {
        label: "Fill alpha",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      }
    }
  },
  loop: {
    label: "Loop timing",
    component: "nested-object",
    fields: {
      assemble: {
        label: "Assemble (fraction of loop)",
        component: "slider",
        min: 0.1,
        max: 0.95,
        step: 0.01
      },
      hold: {
        label: "Hold (fraction of loop)",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
