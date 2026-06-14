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

  physics: {
    ballCount: 51,
    ballSizeMin: 20,
    ballSizeMax: 50,
    handRadius: 75
  },

  // Push the dots away from every tracked fingertip / palm.
  repulse: {
    strength: 0.5,
    maxForce: 0.02,
    distance: 600
  },

  visuals: {
    shadowsCount: 3,
    dotScale: 1,
    // Lower = longer light trails (less is erased each frame).
    trail: 255
  },

  text: {
    show: true,
    title: "repulse",
    subtitle: "hand tracking v2"
  }
};

export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,

  backgroundColor: {
    component: "color",
    label: "Background color"
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

  repulse: {
    component: "nested-object",
    label: "Repulsion",
    initialExpanded: true,
    fields: {
      strength: {
        label: "Push strength",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      maxForce: {
        label: "Max force (speed cap)",
        component: "slider",
        min: 0.005,
        max: 0.1,
        step: 0.005
      },
      distance: {
        label: "Reach (px)",
        component: "slider",
        min: 50,
        max: 1200,
        step: 10
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

  text: {
    component: "nested-object",
    label: "Overlay text",
    fields: {
      show: {
        label: "Show text",
        component: "checkbox"
      },
      title: {
        label: "Title",
        component: "text"
      },
      subtitle: {
        label: "Subtitle",
        component: "text"
      }
    }
  }
};
