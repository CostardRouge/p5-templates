import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

export const formValues = {
  text: {
    value: "FLOW",
    font: "waverseVariable",
    size: 0.4,
    sampleFactor: 0.15,
    simplifyThreshold: 0,
    contourBreak: 0.18,
    spacing: 0.012
  },
  // The fixed screen direction the trace is rotated to flow along. (0, -1) sends
  // it up the screen ("the road ahead"); only the direction matters, not length.
  direction: {
    x: 0,
    y: -1
  },
  draw: {
    // "progressive" draws the outline as the pen passes; "predrawn" lays the
    // whole road down (traveled part bright, the rest a faint ghost ahead).
    reveal: "predrawn" as "progressive" | "predrawn",
    easing: "easeInOutSine",
    // 0 = no rotation (the scribe's upright follow); 1 = fully on rails.
    rotationAmount: 1,
    // How many samples ahead the camera aims, so it anticipates curves.
    anticipation: 6,
    // Extra roll leaned into curves, proportional to how sharply they turn.
    banking: 0.15,
    // Pen-lift gap (in samples) between contours, where it re-orients.
    lift: 8,
    // Faint alpha of the road still ahead in predrawn mode.
    ghostAlpha: 40
  },
  camera: {
    followZoom: 3,
    // Where the pen sits on screen: 0.5 centred, higher = lower ("road ahead").
    anchorY: 0.62,
    reveal: true
  },
  stroke: {
    weight: 6,
    color: [
      255,
      255,
      255
    ] as number[],
    rainbow: true,
    palette: "rainbow",
    hueSpread: 0.6,
    hueSpeed: 0,
    hueOffset: 0,
    penDot: true,
    penDotSize: 14
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
    hold: 0.2
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
  direction: {
    label: "Flow direction",
    component: "vector2d",
    allowNegative: true,
    min: -1,
    max: 1,
    step: 0.01,
    // Match screen / p5 axes: dragging the handle up gives a negative y, which
    // sends the trace up the screen. Only the direction matters, not length.
    yDown: true
  },
  draw: {
    label: "Drawing",
    component: "nested-object",
    fields: {
      reveal: {
        label: "Lines",
        component: "select",
        options: [
          {
            label: "Drawn as the pen passes",
            value: "progressive"
          },
          {
            label: "Road laid ahead (ghost + bright trail)",
            value: "predrawn"
          }
        ]
      },
      rotationAmount: {
        label: "On-rails amount (0 = upright follow)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      anticipation: {
        label: "Anticipation (look-ahead samples)",
        component: "slider",
        min: 0,
        max: 40,
        step: 1
      },
      banking: {
        label: "Banking into curves",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      lift: {
        label: "Pen lift between outlines (samples)",
        component: "slider",
        min: 0,
        max: 40,
        step: 1
      },
      ghostAlpha: {
        label: "Road-ahead ghost alpha (predrawn)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
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
      anchorY: {
        label: "Pen anchor (top → bottom of screen)",
        component: "slider",
        min: 0.1,
        max: 0.9,
        step: 0.01
      },
      reveal: {
        label: "Un-rotate and pull back to reveal the word?",
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
        label: "Hue spread (per outline)",
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
        label: "Reveal + hold (fraction of loop)",
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
