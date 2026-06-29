import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Default values only — exposed at runtime as `options.sketch.*`
export const formValues = {
  // Camera / pointer interaction (hands, fingers, mouse, orbit, …)
  interaction: {
    ...interactionFormValues,
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false
    },
    vision: {
      ...interactionFormValues.vision,
      enabled: true,
      hands: {
        ...interactionFormValues.vision.hands,
        enabled: false,
        landmarks: {
          fingertips: true,
          palm: true
        }
      },
      fingers: {
        ...interactionFormValues.vision.fingers,
        enabled: true
      }
    }
  },

  // Dark background makes the smeared asset colours pop
  backgroundColor: [
    12,
    12,
    14
  ],

  // What you paint FROM
  source: {
    mode: "webcam",
    image: null,
    mirror: true,
    assetOpacity: 0
  },

  // Video asset (used when source mode is "video")
  videos: [],

  // The smear brush
  brush: {
    size: 36,
    spacing: 0.35,
    opacity: 200,
    maxStamps: 2000
  },

  // Permanent trail, or one that retraces itself backward when the hand pauses
  trail: {
    mode: "permanent",
    hold: 20,
    rewindSpeed: 8
  },

  // The live hand overlay
  hands: {
    show: true,
    size: 24,
    glow: 2,
    resolution: 0.1
  },

  // Overlay text
  text: {
    show: true,
    subtitle: "smear · hand tracking v8"
  }
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,

  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  source: {
    component: "nested-object",
    label: "Source",
    initialExpanded: true,
    fields: {
      mode: {
        component: "select",
        label: "Paint from",
        options: [
          {
            label: "Webcam",
            value: "webcam"
          },
          {
            label: "Image",
            value: "image"
          },
          {
            label: "Video",
            value: "video"
          }
        ]
      },
      image: {
        component: "image",
        label: "Image (image mode)"
      },
      mirror: {
        component: "checkbox",
        label: "Mirror source"
      },
      assetOpacity: {
        component: "slider",
        label: "Show asset under strokes",
        min: 0,
        max: 1,
        step: 0.05
      }
    }
  },

  videos: {
    component: "asset-stack",
    kind: "videos",
    label: "Video (video mode)"
  },

  brush: {
    component: "nested-object",
    label: "Brush",
    initialExpanded: true,
    fields: {
      size: {
        component: "slider",
        label: "Brush size",
        min: 4,
        max: 200,
        step: 1
      },
      spacing: {
        component: "slider",
        label: "Stamp spacing",
        min: 0.1,
        max: 1,
        step: 0.05
      },
      opacity: {
        component: "slider",
        label: "Stamp opacity",
        min: 10,
        max: 255,
        step: 5
      },
      maxStamps: {
        component: "slider",
        label: "Max stamps",
        min: 200,
        max: 6000,
        step: 100
      }
    }
  },

  trail: {
    component: "nested-object",
    label: "Trail",
    initialExpanded: true,
    fields: {
      mode: {
        component: "select",
        label: "Mode",
        options: [
          {
            label: "Permanent",
            value: "permanent"
          },
          {
            label: "Rewind",
            value: "rewind"
          }
        ]
      },
      hold: {
        component: "slider",
        label: "Hold before rewind (frames)",
        min: 0,
        max: 120,
        step: 1
      },
      rewindSpeed: {
        component: "slider",
        label: "Rewind speed (stamps/frame)",
        min: 1,
        max: 40,
        step: 1
      }
    }
  },

  hands: {
    component: "nested-object",
    label: "Hand drawing",
    fields: {
      show: {
        component: "checkbox",
        label: "Show hand"
      },
      size: {
        component: "slider",
        label: "Stroke / dot size",
        min: 5,
        max: 200,
        step: 1
      },
      glow: {
        component: "slider",
        label: "Glow layers",
        min: 1,
        max: 12,
        step: 1
      },
      resolution: {
        component: "slider",
        label: "Stroke resolution (lower = denser)",
        min: 0.01,
        max: 0.3,
        step: 0.01
      }
    }
  },

  text: {
    component: "nested-object",
    label: "Overlay text",
    fields: {
      show: {
        component: "checkbox",
        label: "Show text"
      },
      subtitle: {
        component: "text",
        label: "Subtitle"
      }
    }
  }
};
