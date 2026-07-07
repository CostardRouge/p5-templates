import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

export const formValues = {
  text: {
    value: "SIGNAL",
    font: "waverseVariable",
    size: 0.4,
    sampleFactor: 0.15,
    simplifyThreshold: 0,
    contourBreak: 0.18,
    spacing: 0.012
  },
  draw: {
    focus: "all" as "all" | "single",
    focusIndex: 0,
    reveal: "progressive" as "progressive" | "predrawn",
    easing: "easeInOutSine"
  },
  camera: {
    followZoom: 3.3,
    zoomPunch: 0.12,
    reveal: true
  },
  stroke: {
    weight: 7,
    color: [
      222,
      236,
      232
    ] as number[],
    rainbow: false,
    palette: "purple",
    hueSpread: 0,
    hueSpeed: 0,
    hueOffset: 3.14,
    penDot: true,
    penDotSize: 16
  },
  fill: {
    mode: "none" as "none" | "onComplete" | "always",
    color: [
      222,
      236,
      232
    ] as number[],
    alpha: 28
  },
  loop: {
    assemble: 0.7,
    hold: 0.18
  },
  hud: {
    show: true,
    label: "SIGNALS",
    color: [
      180,
      230,
      210
    ] as number[],
    viewfinder: 0.12
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
  hud: {
    label: "Instrument (HUD)",
    component: "nested-object",
    fields: {
      show: {
        label: "Show instrument frame",
        component: "checkbox"
      },
      label: {
        label: "Header label",
        component: "text"
      },
      color: {
        label: "HUD color",
        component: "color"
      },
      viewfinder: {
        label: "Viewfinder margin",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
