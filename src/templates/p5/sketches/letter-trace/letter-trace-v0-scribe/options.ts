import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  text: {
    value: "HELLO",
    font: "waverseVariable",
    size: 0.4,
    sampleFactor: 0.15,
    simplifyThreshold: 0,
    contourBreak: 0.18,
    spacing: 0.012
  },
  draw: {
    // "all" follows every letter in reading order; "single" stays on one letter.
    focus: "all" as "all" | "single",
    focusIndex: 0,
    // "progressive" draws the outline as the pen passes; "predrawn" shows the
    // whole outline already there and just travels the camera over it.
    reveal: "progressive" as "progressive" | "predrawn",
    easing: "linear"
  },
  camera: {
    followZoom: 3.3,
    zoomPunch: 0,
    reveal: true
  },
  stroke: {
    weight: 8,
    color: [
      255,
      255,
      255
    ] as number[],
    rainbow: true,
    palette: "purple",
    hueSpread: 0,
    hueSpeed: 0,
    hueOffset: 3.14,
    penDot: true,
    penDotSize: 21
  },
  fill: {
    // "none" never fills; "onComplete" drops the fill in once a letter is fully
    // traced; "always" keeps it filled.
    mode: "none" as "none" | "onComplete" | "always",
    color: [
      255,
      255,
      255
    ] as number[],
    alpha: 40
  },
  loop: {
    assemble: 0.7,
    hold: 0.18
  },
  backgroundColor: [
    0,
    0,
    0,
    173
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
        max: 1.5,
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
      focus: {
        label: "Follow",
        component: "select",
        options: [
          {
            label: "All letters (one after another)",
            value: "all"
          },
          {
            label: "A single letter",
            value: "single"
          }
        ]
      },
      focusIndex: {
        label: "Which letter (single mode)",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      },
      reveal: {
        label: "Lines",
        component: "select",
        options: [
          {
            label: "Drawn as the pen passes",
            value: "progressive"
          },
          {
            label: "Already drawn (camera only)",
            value: "predrawn"
          }
        ]
      },
      easing: {
        label: "Writing easing",
        component: "easing"
      }
    }
  },
  camera: {
    label: "Camera",
    component: "nested-object",
    fields: {
      followZoom: {
        label: "Follow zoom",
        component: "slider",
        min: 1,
        max: 8,
        step: 0.1
      },
      zoomPunch: {
        label: "Zoom-in punch per letter",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.05
      },
      reveal: {
        label: "Pull back to reveal the whole word?",
        component: "checkbox"
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
        label: "Color",
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
        label: "Hue spread (per letter)",
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
      },
      penDot: {
        label: "Show the pen tip?",
        component: "checkbox"
      },
      penDotSize: {
        label: "Pen tip size",
        component: "slider",
        min: 0,
        max: 30,
        step: 0.5
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
        label: "Write (fraction of loop)",
        component: "slider",
        min: 0.1,
        max: 0.95,
        step: 0.01
      },
      hold: {
        label: "Hold on the word (fraction of loop)",
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
