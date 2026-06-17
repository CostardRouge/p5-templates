import {
  interactionFormConfiguration,
  interactionFormValues
} from "@/p5/utils/interaction/defaults.js";

export const formValues = {
  interaction: {
    ...interactionFormValues,
    visualization: {
      ...interactionFormValues.visualization,
      enabled: false
    },
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false
    },
    audio: {
      ...interactionFormValues.audio,
      enabled: true,
      fftSize: 1024,
      smoothing: 0.8,
      engine: "dsp",
      features: {
        bands: true,
        spectral: true,
        kick: true,
        onset: true,
        pitch: true,
        voice: true
      }
    }
  },
  backgroundColor: [
    8,
    8,
    14
  ],
  showLabels: true
};

export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  showLabels: {
    component: "checkbox",
    label: "Show labels"
  }
};
