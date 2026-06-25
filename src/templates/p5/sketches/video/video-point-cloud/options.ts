import {
  webcamSourceFormConfiguration,
  webcamSourceFormValues
} from "@/p5/utils/webcam/defaults.js";
import {
  getTestVideoPath
} from "@/utils/getTestVideoPaths";

// Default values only
export const formValues = {
  // Where the frames come from. Webcam = live capture + device picker; Video =
  // the first clip in the asset stack (also segmented). Flip mirrors the cloud.
  source: {
    input: "webcam",
    ...webcamSourceFormValues,
    // Lighter capture keeps the main-thread segmenter responsive.
    width: 640,
    height: 480,
    videos: [
      {
        id: "test-photos-zoom",
        path: await getTestVideoPath( "photos-zoom" ),
        params: {
          repeat: 1,
          speed: 1,
          offset: 0,
          loopMode: "loop",
          scale: 1,
          posX: 0,
          posY: 0,
          fit: "cover"
        }
      }
    ]
  },

  // Active depth algorithm.
  mode: "color",

  // Point grid. Rows are derived from the source aspect ratio at runtime.
  grid: {
    columns: 100,
    fit: "contain"
  },

  // Depth post-processing shared by every mode.
  depth: {
    channel: "luminance",
    near: 320,
    far: -320,
    easing: "easeInOutSine",
    invert: false,
    smoothing: 0.25
  },

  // Point look.
  point: {
    size: 4,
    sizeByDepth: 0.4
  },

  // How points are coloured.
  color: {
    source: "video",
    opacity: 255,
    hueOffset: 0,
    hueScale: 3
  },

  // Subtle camera wobble that sells the relief.
  rotation: {
    enabled: true,
    xBase: 0,
    yBase: 0,
    angleMax: 0.15,
    xMultiplier: 0,
    yMultiplier: 0.5,
    zMultiplier: 0
  },

  // Per-mode parameters (only the active mode's sub-tree is read).
  modes: {
    color: {
      normalization: "relative",
      rangeSmoothing: 0.1,
      fixedLow: 0,
      fixedHigh: 1
    },
    depth: {
      minDepth: 0,
      maxDepth: 1,
      intervalMs: 120,
      depthModelUrl: "",
      segmentationModelUrl: ""
    },
    wave: {
      freqX: 3,
      freqY: 3,
      speed: 1,
      amplitude: 1
    },
    perlin: {
      scale: 2,
      speed: 0.3
    },
    motion: {
      gain: 6,
      threshold: 0.04,
      decay: 0.9,
      direction: "forward"
    }
  },

  backgroundColor: [
    8,
    8,
    10
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  source: {
    component: "nested-object",
    label: "Source",
    initialExpanded: true,
    fields: {
      input: {
        component: "select",
        label: "Input",
        options: [
          {
            label: "Webcam",
            value: "webcam"
          },
          {
            label: "Video asset",
            value: "video"
          }
        ]
      },
      ...webcamSourceFormConfiguration.fields,
      videos: {
        component: "asset-stack",
        kind: "videos",
        label: "Video asset (when Input = Video)"
      }
    }
  },

  mode: {
    component: "select",
    label: "Depth mode",
    options: [
      {
        label: "Couleur → profondeur",
        value: "color"
      },
      {
        label: "Depth map (IA)",
        value: "depth"
      },
      {
        label: "Vague / ondulation",
        value: "wave"
      },
      {
        label: "Aléatoire / Perlin",
        value: "perlin"
      },
      {
        label: "Mouvement",
        value: "motion"
      }
    ]
  },

  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      columns: {
        component: "slider",
        label: "Columns (density)",
        min: 16,
        max: 240,
        step: 1
      },
      fit: {
        component: "select",
        label: "Fit",
        options: [
          {
            label: "Contain",
            value: "contain"
          },
          {
            label: "Cover",
            value: "cover"
          },
          {
            label: "Stretch",
            value: "stretch"
          }
        ]
      }
    }
  },

  depth: {
    component: "nested-object",
    label: "Depth",
    fields: {
      channel: {
        component: "select",
        label: "Perceived channel",
        options: [
          {
            label: "Luminance",
            value: "luminance"
          },
          {
            label: "Hue",
            value: "hue"
          },
          {
            label: "Saturation",
            value: "saturation"
          },
          {
            label: "Red",
            value: "red"
          },
          {
            label: "Green",
            value: "green"
          },
          {
            label: "Blue",
            value: "blue"
          }
        ]
      },
      near: {
        component: "slider",
        label: "Nearest point (Z)",
        min: 0,
        max: 1000,
        step: 1
      },
      far: {
        component: "slider",
        label: "Deepest point (Z)",
        min: -1000,
        max: 0,
        step: 1
      },
      easing: {
        component: "easing",
        label: "Depth easing"
      },
      invert: {
        component: "checkbox",
        label: "Invert depth"
      },
      smoothing: {
        component: "slider",
        label: "Temporal smoothing",
        min: 0,
        max: 0.98,
        step: 0.01
      }
    }
  },

  point: {
    component: "nested-object",
    label: "Points",
    fields: {
      size: {
        component: "slider",
        label: "Point size",
        min: 0.5,
        max: 40,
        step: 0.5
      },
      sizeByDepth: {
        component: "slider",
        label: "Size by depth",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },

  color: {
    component: "nested-object",
    label: "Colour",
    fields: {
      source: {
        component: "select",
        label: "Colour source",
        options: [
          {
            label: "Video pixel",
            value: "video"
          },
          {
            label: "Palette (by depth)",
            value: "palette"
          }
        ]
      },
      opacity: {
        component: "slider",
        label: "Opacity",
        min: 0,
        max: 255,
        step: 1
      },
      hueOffset: {
        component: "slider",
        label: "Palette hue offset",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      hueScale: {
        component: "slider",
        label: "Palette hue scale",
        min: 0,
        max: 12,
        step: 0.1
      }
    }
  },

  rotation: {
    component: "nested-object",
    label: "Camera wobble",
    fields: {
      enabled: {
        component: "checkbox",
        label: "Animated wobble?"
      },
      xBase: {
        component: "slider",
        label: "Base X tilt",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      yBase: {
        component: "slider",
        label: "Base Y tilt",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      angleMax: {
        component: "slider",
        label: "Wobble amplitude",
        min: 0,
        max: Math.PI / 2,
        step: 0.01
      },
      xMultiplier: {
        component: "slider",
        label: "X wobble speed",
        min: -9,
        max: 9,
        step: 0.1
      },
      yMultiplier: {
        component: "slider",
        label: "Y wobble speed",
        min: -9,
        max: 9,
        step: 0.1
      },
      zMultiplier: {
        component: "slider",
        label: "Z wobble speed",
        min: -9,
        max: 9,
        step: 0.1
      }
    }
  },

  modes: {
    component: "nested-object",
    label: "Mode settings",
    fields: {
      color: {
        component: "nested-object",
        label: "Couleur → profondeur",
        fields: {
          normalization: {
            component: "select",
            label: "Normalisation",
            options: [
              {
                label: "Relative (frame min/max)",
                value: "relative"
              },
              {
                label: "Absolute (0–255)",
                value: "absolute"
              },
              {
                label: "Fixed range",
                value: "fixed"
              }
            ]
          },
          rangeSmoothing: {
            component: "slider",
            label: "Range smoothing (relative)",
            min: 0.01,
            max: 1,
            step: 0.01
          },
          fixedLow: {
            component: "slider",
            label: "Fixed low",
            min: 0,
            max: 1,
            step: 0.01
          },
          fixedHigh: {
            component: "slider",
            label: "Fixed high",
            min: 0,
            max: 1,
            step: 0.01
          }
        }
      },
      depth: {
        component: "nested-object",
        label: "Depth map (IA)",
        fields: {
          minDepth: {
            component: "slider",
            label: "Model min depth",
            min: 0,
            max: 1,
            step: 0.01
          },
          maxDepth: {
            component: "slider",
            label: "Model max depth",
            min: 0,
            max: 1,
            step: 0.01
          },
          intervalMs: {
            component: "slider",
            label: "Inference interval (ms)",
            min: 40,
            max: 500,
            step: 10
          },
          depthModelUrl: {
            component: "text",
            label: "Depth model URL (blank = TF Hub default)"
          },
          segmentationModelUrl: {
            component: "text",
            label: "Segmentation model URL (blank = default)"
          }
        }
      },
      wave: {
        component: "nested-object",
        label: "Vague / ondulation",
        fields: {
          freqX: {
            component: "slider",
            label: "Frequency X",
            min: 0,
            max: 16,
            step: 0.1
          },
          freqY: {
            component: "slider",
            label: "Frequency Y",
            min: 0,
            max: 16,
            step: 0.1
          },
          speed: {
            component: "slider",
            label: "Speed",
            min: 0,
            max: 8,
            step: 0.1
          },
          amplitude: {
            component: "slider",
            label: "Amplitude",
            min: 0,
            max: 1,
            step: 0.01
          }
        }
      },
      perlin: {
        component: "nested-object",
        label: "Aléatoire / Perlin",
        fields: {
          scale: {
            component: "slider",
            label: "Noise scale",
            min: 0.1,
            max: 10,
            step: 0.1
          },
          speed: {
            component: "slider",
            label: "Animation speed",
            min: 0,
            max: 3,
            step: 0.01
          }
        }
      },
      motion: {
        component: "nested-object",
        label: "Mouvement",
        fields: {
          gain: {
            component: "slider",
            label: "Gain",
            min: 0,
            max: 20,
            step: 0.1
          },
          threshold: {
            component: "slider",
            label: "Threshold",
            min: 0,
            max: 0.5,
            step: 0.005
          },
          decay: {
            component: "slider",
            label: "Decay (return to flat)",
            min: 0.5,
            max: 0.99,
            step: 0.01
          },
          direction: {
            component: "select",
            label: "Direction",
            options: [
              {
                label: "Forward",
                value: "forward"
              },
              {
                label: "Backward",
                value: "backward"
              }
            ]
          }
        }
      }
    }
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
