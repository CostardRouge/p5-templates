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

  // How the live hand (and each ghost) is drawn
  hands: {
    size: 30,
    glow: 2,
    resolution: 0.08
  },

  // Trailing ghosts of the hand
  echo: {
    count: 6,
    spacing: 4,
    minAlpha: 0.1,
    ghostAlpha: 0.55
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
