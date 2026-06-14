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

  // Background
  backgroundColor: [
    246,
    235,
    225
  ],

  // How the tracked hands / pointers are drawn (neon strokes + dots)
  hands: {
    size: 30,
    glow: 2,
    resolution: 0.08
  },

  // Each character becomes a draggable physics box. Edit the string to scatter
  // your own word, alphabet or set of glyphs across the canvas.
  text: {
    content: "abcdefghijklmnopqrstuvwxyz0123456789",
    letterSize: 144
  },

  physics: {
    handRadius: 75
  },

  // How the letters tumble and snap back into place.
  letters: {
    restitution: 0.4,
    friction: 0.1,
    restoreStrength: 0.0001,
    restoreMaxForce: 0.003
  },

  visuals: {
    shadowsCount: 3,
    dotScale: 1
  }
};

export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,

  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  hands: {
    component: "nested-object",
    label: "Hand drawing",
    fields: {
      size: {
        label: "Stroke / dot size",
        component: "slider",
        min: 5,
        max: 200,
        step: 1
      },
      glow: {
        label: "Glow layers",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      resolution: {
        label: "Stroke resolution (lower = denser)",
        component: "slider",
        min: 0.01,
        max: 0.3,
        step: 0.01
      }
    }
  },

  text: {
    component: "nested-object",
    label: "Text",
    initialExpanded: true,
    fields: {
      content: {
        label: "Characters",
        component: "textarea"
      },
      letterSize: {
        label: "Letter size",
        component: "slider",
        min: 40,
        max: 320,
        step: 1
      }
    }
  },

  physics: {
    component: "nested-object",
    label: "Physics",
    fields: {
      handRadius: {
        label: "Hand touch radius",
        component: "slider",
        min: 10,
        max: 250,
        step: 1
      }
    }
  },

  letters: {
    component: "nested-object",
    label: "Letter behaviour",
    initialExpanded: true,
    fields: {
      restitution: {
        label: "Bounciness",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      friction: {
        label: "Friction",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      restoreStrength: {
        label: "Return spring stiffness",
        component: "slider",
        min: 0,
        max: 0.002,
        step: 0.0001
      },
      restoreMaxForce: {
        label: "Return speed cap",
        component: "slider",
        min: 0.0005,
        max: 0.02,
        step: 0.0005
      }
    }
  },

  visuals: {
    component: "nested-object",
    label: "Neon visuals",
    fields: {
      shadowsCount: {
        label: "Glow layers",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      dotScale: {
        label: "Dot scale",
        component: "slider",
        min: 0.2,
        max: 3,
        step: 0.05
      }
    }
  }
};
