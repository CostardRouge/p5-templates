import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Shared interaction defaults tuned for this sketch: six orbiting virtual
// pointers deform the plane out of the box (matching the sketch's original
// `spheresCount`). Mouse and vision stay opt-in, and the on-canvas overlay is
// muted since the sketch renders its own 3D spheres for each pointer.
const interactionDefaults = {
  ...interactionFormValues,
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
  texture: {
    image: null,
    useWebcam: false
  },
  grid: {
    columns: 20,
    rows: 30,
    stroke: {
      color: [
        0
      ],
      hide: false
    }
  },
  // How the plane reacts to interaction pointers, plus the 3D sphere markers
  // rendered at each pointer and the optional webcam backdrop.
  animation: {
    showWebcam: false,
    showSpheres: false,
    sphereSize: 30,
    depth: 100,
    maxInfluenceDistance: 150,
    easing: "easeOutBack"
  },
  interaction: interactionDefaults,
  title: titleDefaultValues,
  backgroundColor: [
    246,
    235,
    225
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  texture: {
    component: "nested-object",
    label: "Texture",
    fields: {
      image: {
        component: "image",
        label: "Image"
      },
      useWebcam: {
        label: "Use webcam as texture",
        component: "checkbox"
      }
    }
  },
  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      columns: {
        label: "Grid columns",
        component: "slider",
        min: 1,
        max: 100
      },
      rows: {
        label: "Grid rows",
        component: "slider",
        min: 1,
        max: 100
      },
      stroke: {
        component: "nested-object",
        label: "Stroke",
        fields: {
          color: {
            component: "color",
            label: "stroke"
          },
          hide: {
            label: "noStroke()",
            component: "checkbox"
          }
        }
      }
    }
  },
  animation: {
    component: "nested-object",
    label: "Animation",
    fields: {
      showWebcam: {
        label: "Show webcam",
        component: "checkbox"
      },
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
      depth: {
        label: "Depth",
        component: "slider",
        min: 1,
        max: 500
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
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
