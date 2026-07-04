import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Default values only — exposed at runtime as `options.sketch.*`
export const formValues = {
  // One palm point per hand: a single clean pointer to grab / shove with.
  interaction: {
    ...interactionFormValues,
    mouse: {
      ...interactionFormValues.mouse,
      enabled: true
    },
    vision: {
      ...interactionFormValues.vision,
      enabled: true,
      hands: {
        ...interactionFormValues.vision.hands,
        enabled: false,
        landmarks: {
          fingertips: false,
          palm: true
        }
      }
    }
  },

  backgroundColor: [
    12,
    12,
    14
  ],

  // The word being puppeteered
  text: {
    content: "PULL ME",
    font: "martian",
    size: 0.16,
    lineHeight: 1.15,
    fill: [
      255,
      255,
      255
    ],
    stroke: [
      255,
      255,
      255
    ],
    strokeWeight: 0
  },

  // Gesture → behavior mapping
  gestures: {
    grabThreshold: 0.45,
    grabStrength: 0.045,
    grabRadius: 420,
    explodeThreshold: 0.7,
    explodeStrength: 3.2,
    explodeRadius: 520,
    fistThreshold: 0.25,
    mouseGrab: true
  },

  // The spring pulling every letter home
  spring: {
    stiffness: 0.012,
    damping: 0.08,
    fistBoost: 8
  },

  // Velocity-driven letter tilt / stretch
  motion: {
    tilt: 0.014,
    stretch: 0.012
  },

  // The live hand overlay
  hands: {
    show: true,
    size: 28,
    glow: 2,
    resolution: 0.1
  },

  // Overlay text
  overlay: {
    show: true,
    subtitle: "puppet type · hand tracking v15"
  }
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,

  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  text: {
    component: "nested-object",
    label: "Text",
    initialExpanded: true,
    fields: {
      content: {
        component: "text",
        label: "Word (newlines allowed)"
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
        label: "Letter size (× canvas width)",
        min: 0.04,
        max: 0.5,
        step: 0.01
      },
      lineHeight: {
        component: "slider",
        label: "Line height",
        min: 0.8,
        max: 2,
        step: 0.05
      },
      fill: {
        component: "color",
        label: "Letter fill"
      },
      stroke: {
        component: "color",
        label: "Letter stroke"
      },
      strokeWeight: {
        component: "slider",
        label: "Letter stroke weight",
        min: 0,
        max: 12,
        step: 0.5
      }
    }
  },

  gestures: {
    component: "nested-object",
    label: "Gestures",
    initialExpanded: true,
    fields: {
      grabThreshold: {
        component: "slider",
        label: "Pinch threshold (grab)",
        min: 0,
        max: 1,
        step: 0.05
      },
      grabStrength: {
        component: "slider",
        label: "Grab strength",
        min: 0,
        max: 0.2,
        step: 0.005
      },
      grabRadius: {
        component: "slider",
        label: "Grab radius",
        min: 50,
        max: 1500,
        step: 10
      },
      explodeThreshold: {
        component: "slider",
        label: "Spread threshold (explode)",
        min: 0,
        max: 1,
        step: 0.05
      },
      explodeStrength: {
        component: "slider",
        label: "Explode strength",
        min: 0,
        max: 12,
        step: 0.1
      },
      explodeRadius: {
        component: "slider",
        label: "Explode radius",
        min: 50,
        max: 1500,
        step: 10
      },
      fistThreshold: {
        component: "slider",
        label: "Fist threshold (reassemble)",
        min: 0,
        max: 1,
        step: 0.05
      },
      mouseGrab: {
        component: "checkbox",
        label: "Mouse grabs when no hand is tracked"
      }
    }
  },

  spring: {
    component: "nested-object",
    label: "Home spring",
    fields: {
      stiffness: {
        component: "slider",
        label: "Stiffness",
        min: 0,
        max: 0.08,
        step: 0.001
      },
      damping: {
        component: "slider",
        label: "Damping",
        min: 0.01,
        max: 0.3,
        step: 0.01
      },
      fistBoost: {
        component: "slider",
        label: "Fist snap-back boost",
        min: 1,
        max: 20,
        step: 0.5
      }
    }
  },

  motion: {
    component: "nested-object",
    label: "Letter motion",
    fields: {
      tilt: {
        component: "slider",
        label: "Velocity tilt",
        min: 0,
        max: 0.05,
        step: 0.001
      },
      stretch: {
        component: "slider",
        label: "Velocity stretch",
        min: 0,
        max: 0.05,
        step: 0.001
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

  overlay: {
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
