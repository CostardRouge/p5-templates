import {
  interactionFormConfiguration, interactionFormValues
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

  physics: {
    ballCount: 51,
    ballSizeMin: 20,
    ballSizeMax: 50,
    handRadius: 75
  },

  // Pull the dots toward every tracked fingertip / palm.
  attract: {
    strength: 0.0005,
    maxForce: 0.002
  },

  visuals: {
    shadowsCount: 3,
    dotScale: 1,
    // Lower = longer light trails (less is erased each frame).
    trail: 255
  },

  // Legacy centred splash (rendered by @/p5/utils/title/renderLegacyTitle.js)
  title: "attract",
  subtitle: "hand tracking v1"
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

  physics: {
    component: "nested-object",
    label: "Physics",
    initialExpanded: true,
    fields: {
      ballCount: {
        label: "Ball count",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      ballSizeMin: {
        label: "Ball size (min)",
        component: "slider",
        min: 5,
        max: 200,
        step: 1
      },
      ballSizeMax: {
        label: "Ball size (max)",
        component: "slider",
        min: 5,
        max: 300,
        step: 1
      },
      handRadius: {
        label: "Hand touch radius",
        component: "slider",
        min: 10,
        max: 250,
        step: 1
      }
    }
  },

  attract: {
    component: "nested-object",
    label: "Attraction",
    initialExpanded: true,
    fields: {
      strength: {
        label: "Pull strength",
        component: "slider",
        min: 0,
        max: 0.005,
        step: 0.0001
      },
      maxForce: {
        label: "Max force (speed cap)",
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
      },
      trail: {
        label: "Trail fade (lower = longer)",
        component: "slider",
        min: 1,
        max: 255,
        step: 1
      }
    }
  },

  title: {
    label: "Title",
    component: "text"
  },

  subtitle: {
    label: "Subtitle",
    component: "text"
  }
};
