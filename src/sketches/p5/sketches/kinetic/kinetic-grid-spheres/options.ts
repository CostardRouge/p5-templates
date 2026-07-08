import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Shared interaction defaults tuned for this sketch: six orbiting virtual
// pointers drive the grid out of the box (matching the sketch's original
// `spheresCount`), with hand tracking on by default. The on-canvas overlay is
// muted since the sketch renders its own 3D spheres for each pointer.
const interactionDefaults = {
  ...interactionFormValues,
  vision: {
    ...interactionFormValues.vision,
    enabled: true,
    hands: {
      ...interactionFormValues.vision.hands,
      enabled: true
    }
  },
  orbit: {
    ...interactionFormValues.orbit,
    enabled: true,
    count: 6
  },
  visualization: {
    ...interactionFormValues.visualization,
    enabled: false
  }
};

export const formValues = {
  grid: {
    gap: 3,
    depth: 10,
    columns: 36
  },
  // How the grid reacts to interaction pointers, plus the 3D sphere markers
  // rendered at each pointer.
  animation: {
    showSpheres: true,
    sphereSize: 30,
    maxInfluenceDistance: 150,
    easing: "easeOutBack"
  },
  interaction: interactionDefaults,
  color: {
    opacityFactor: 1.5,
    fillAlphaStart: 230,
    fillAlphaEnd: 20,
    strokeAlpha: 200,
    hueMultiplier: 2
  },
  backgroundColor: [
    246,
    235,
    225
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      gap: {
        label: "Gap",
        component: "slider",
        min: 1,
        max: 500,
        step: 0.5
      },
      depth: {
        label: "Depth",
        component: "slider",
        min: 1,
        max: 500
      },
      columns: {
        label: "Grid columns",
        component: "slider",
        min: 10,
        max: 300
      }
    }
  },
  animation: {
    component: "nested-object",
    label: "Animation",
    fields: {
      showSpheres: {
        label: "Show spheres",
        component: "checkbox"
      },
      sphereSize: {
        label: "Sphere size",
        component: "slider",
        min: 1,
        max: 100
      },
      maxInfluenceDistance: {
        label: "Max influence distance",
        component: "slider",
        min: 0,
        max: 500,
        step: 0.5
      },
      easing: {
        component: "easing",
        label: "Depth easing"
      }
    }
  },
  interaction: interactionFormConfiguration,
  color: {
    component: "nested-object",
    label: "Color",
    fields: {
      opacityFactor: {
        label: "Opacity factor",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.1
      },
      fillAlphaStart: {
        label: "Fill alpha (visible)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      fillAlphaEnd: {
        label: "Fill alpha (hidden)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      strokeAlpha: {
        label: "Stroke alpha",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      hueMultiplier: {
        label: "Hue range multiplier",
        component: "slider",
        min: 0.5,
        max: 5,
        step: 0.1
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
