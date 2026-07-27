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

  // How the tracked hands / pointers (the blade) are drawn
  hands: {
    size: 30,
    glow: 2,
    resolution: 0.08
  },

  // Tossed "fruit"
  toss: {
    spawnRate: 1.2,
    fruitSizeMin: 45,
    fruitSizeMax: 75,
    speed: 30,
    gravity: 0.7
  },

  // Blade behaviour
  slice: {
    swipeSpeed: 25,
    bladeWidth: 20,
    minPiece: 16,
    splitSpeed: 6,
    bladeTrail: 60
  },

  // Neon look of the fruit
  visuals: {
    shadowsCount: 3,
    dotScale: 1,
    // Lower = longer light trails (less is erased each frame).
    trail: 40
  },

  // Implicit score
  score: {
    show: true
  },

  // Legacy centred splash (rendered by @/p5/utils/title/renderLegacyTitle.js)
  title: "",
  subtitle: "slice · hand tracking v6"
};

// UI configuration only
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

  toss: {
    component: "nested-object",
    label: "Toss",
    initialExpanded: true,
    fields: {
      spawnRate: {
        label: "Fruit per second",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      fruitSizeMin: {
        label: "Fruit size (min)",
        component: "slider",
        min: 10,
        max: 120,
        step: 1
      },
      fruitSizeMax: {
        label: "Fruit size (max)",
        component: "slider",
        min: 10,
        max: 160,
        step: 1
      },
      speed: {
        label: "Toss speed",
        component: "slider",
        min: 5,
        max: 60,
        step: 1
      },
      gravity: {
        label: "Arc gravity",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.1
      }
    }
  },

  slice: {
    component: "nested-object",
    label: "Blade",
    initialExpanded: true,
    fields: {
      swipeSpeed: {
        label: "Swipe sensitivity (px/frame)",
        component: "slider",
        min: 5,
        max: 80,
        step: 1
      },
      bladeWidth: {
        label: "Blade width",
        component: "slider",
        min: 4,
        max: 80,
        step: 1
      },
      minPiece: {
        label: "Smallest piece",
        component: "slider",
        min: 4,
        max: 60,
        step: 1
      },
      splitSpeed: {
        label: "Split speed",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.5
      },
      bladeTrail: {
        label: "Blade trail (lower = longer)",
        component: "slider",
        min: 1,
        max: 255,
        step: 1
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

  score: {
    component: "nested-object",
    label: "Score",
    fields: {
      show: {
        label: "Show score",
        component: "checkbox"
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
