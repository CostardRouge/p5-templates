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

  // Background (dark makes the neon ghosts pop)
  backgroundColor: [
    18,
    18,
    20
  ],

  // How the live hand (and each ghost) is drawn — a shader-based neon spline
  // through each finger/hand chain (the same GPU glow pipeline as the
  // `splines · interactive` sketch), replacing the legacy CPU neon line.
  spline: {
    weight: 18,
    glow: 2,
    iterations: 6,
    hueSpeed: 1.5,
    hueSpread: 2
  },

  // Trailing ghosts of the hand
  echo: {
    count: 6,
    spacing: 4,
    minAlpha: 0.1,
    ghostAlpha: 0.55
  },

  // Let the echo trail grow in a direction — each older ghost is pushed further
  // along the chosen edge, ramped through the easing, for a comet-like streak.
  extend: {
    enabled: true,
    direction: "up" as "up" | "down" | "left" | "right",
    distance: 220,
    easing: "easeOutCubic"
  },

  // Overlay text — centered title (like the move / attract / restore sketches)
  text: {
    show: true,
    title: "echo",
    subtitle: "hand tracking v7"
  }
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,

  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  spline: {
    component: "nested-object",
    label: "Spline stroke",
    fields: {
      weight: {
        label: "Stroke weight",
        component: "slider",
        min: 1,
        max: 40,
        step: 0.5
      },
      glow: {
        label: "Glow layers",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      iterations: {
        label: "Smoothing (Chaikin iterations)",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      hueSpeed: {
        label: "Hue speed (over time)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      hueSpread: {
        label: "Hue spread along path",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.05
      }
    }
  },

  echo: {
    component: "nested-object",
    label: "Echo",
    initialExpanded: true,
    fields: {
      count: {
        label: "Ghost count",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      spacing: {
        label: "Frames between ghosts",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      minAlpha: {
        label: "Oldest ghost opacity",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      ghostAlpha: {
        label: "Newest ghost opacity",
        component: "slider",
        min: 0.1,
        max: 1,
        step: 0.01
      }
    }
  },

  extend: {
    component: "nested-object",
    label: "Echo growth",
    initialExpanded: true,
    fields: {
      enabled: {
        label: "Grow the echo trail",
        component: "checkbox"
      },
      direction: {
        label: "Direction",
        component: "select",
        options: [
          {
            label: "Up",
            value: "up"
          },
          {
            label: "Down",
            value: "down"
          },
          {
            label: "Left",
            value: "left"
          },
          {
            label: "Right",
            value: "right"
          }
        ]
      },
      distance: {
        label: "Growth distance (px)",
        component: "slider",
        min: 0,
        max: 600,
        step: 5
      },
      easing: {
        label: "Growth easing",
        component: "easing"
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
