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

  // Falling drops
  rain: {
    spawnRate: 6,
    dropSizeMin: 20,
    dropSizeMax: 40,
    gravity: 1
  },

  // How forgiving the catch is (distance from a hand point)
  catch: {
    radius: 70
  },

  // Neon look of the drops
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
  subtitle: "catch · hand tracking v5"
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

  rain: {
    component: "nested-object",
    label: "Rain",
    initialExpanded: true,
    fields: {
      spawnRate: {
        label: "Drops per second",
        component: "slider",
        min: 0,
        max: 40,
        step: 0.5
      },
      dropSizeMin: {
        label: "Drop size (min)",
        component: "slider",
        min: 5,
        max: 100,
        step: 1
      },
      dropSizeMax: {
        label: "Drop size (max)",
        component: "slider",
        min: 5,
        max: 150,
        step: 1
      },
      gravity: {
        label: "Fall speed",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.1
      }
    }
  },

  catch: {
    component: "nested-object",
    label: "Catch",
    initialExpanded: true,
    fields: {
      radius: {
        label: "Catch radius",
        component: "slider",
        min: 20,
        max: 200,
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
