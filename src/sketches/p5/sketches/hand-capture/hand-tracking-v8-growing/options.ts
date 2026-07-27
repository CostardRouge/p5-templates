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

  // How the live hand is drawn — a shader-based neon spline through each
  // finger/hand chain (the same GPU glow pipeline as the `splines · interactive`
  // sketch), replacing the legacy CPU neon line.
  spline: {
    weight: 18,
    glow: 2,
    iterations: 6,
    hueSpeed: 1.5,
    hueSpread: 2
  },

  // The echo is a feedback buffer rather than discrete ghosts, so only the live
  // hand is re-drawn each frame. `decay` is how much of the trail survives every
  // frame (higher = longer trail).
  echo: {
    decay: 0.9
  },

  // How the trail is aged each frame: drift toward an edge for a comet streak,
  // or "grow" to bloom each copy bigger + darker behind the hand.
  effect: {
    type: "up" as "up" | "down" | "left" | "right" | "grow",
    speed: 8,
    scale: 1.03,
    darken: 0.12
  },

  // Legacy centred splash (rendered by @/p5/utils/title/renderLegacyTitle.js)
  title: "growing",
  subtitle: "hand tracking v8"
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
      decay: {
        label: "Trail persistence (higher = longer)",
        component: "slider",
        min: 0.5,
        max: 0.99,
        step: 0.01
      }
    }
  },

  effect: {
    component: "nested-object",
    label: "Echo growth",
    initialExpanded: true,
    fields: {
      type: {
        label: "Effect",
        component: "select",
        options: [
          {
            label: "Drift up",
            value: "up"
          },
          {
            label: "Drift down",
            value: "down"
          },
          {
            label: "Drift left",
            value: "left"
          },
          {
            label: "Drift right",
            value: "right"
          },
          {
            label: "Grow (bigger + darker)",
            value: "grow"
          }
        ]
      },
      speed: {
        label: "Drift speed (px / frame)",
        component: "slider",
        min: 0,
        max: 30,
        step: 0.5
      },
      scale: {
        label: "Grow scale (per frame)",
        component: "slider",
        min: 1,
        max: 1.1,
        step: 0.005
      },
      darken: {
        label: "Grow darken (per frame)",
        component: "slider",
        min: 0,
        max: 0.4,
        step: 0.01
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
