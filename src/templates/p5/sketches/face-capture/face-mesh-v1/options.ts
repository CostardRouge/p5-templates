import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Default values only
export const formValues = {
  // Live face mesh from the webcam. The interaction layer owns the camera and
  // the MediaPipe FaceLandmarker task; the sketch just reads its output.
  interaction: {
    ...interactionFormValues,
    enabled: true,
    vision: {
      ...interactionFormValues.vision,
      enabled: true,
      source: {
        ...interactionFormValues.vision.source,
        showPreview: false
      },
      faceMesh: {
        ...interactionFormValues.vision.faceMesh,
        enabled: true
      }
    }
  },

  // Base dot size — mouth-open swells it at runtime.
  pointSize: 5.5,

  // Palette rotation — smile warms it at runtime.
  hueOffset: 0,

  backgroundColor: [
    8,
    10,
    18
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,

  pointSize: {
    component: "slider",
    label: "Point size",
    min: 1,
    max: 16,
    step: 0.5
  },

  hueOffset: {
    component: "slider",
    label: "Palette hue offset",
    min: -Math.PI,
    max: Math.PI,
    step: 0.01
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
