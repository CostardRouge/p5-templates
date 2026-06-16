import {
  webcamSourceFormConfiguration,
  webcamSourceFormValues
} from "@/p5/utils/webcam/defaults.js";

// Default values only
export const formValues = {
  // Live camera source — the shared webcam-device-select picker.
  camera: {
    ...webcamSourceFormValues
  },

  // Grid layout
  rows: 3,
  columns: 9,

  // Per-cell effects
  blur: 6,
  displacement: 0.4,
  colorShift: 0.4,

  // Colors
  backgroundColor: [
    10,
    10,
    12
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  camera: webcamSourceFormConfiguration,

  rows: {
    component: "slider",
    label: "Rows",
    min: 1,
    max: 12,
    step: 1
  },

  columns: {
    component: "slider",
    label: "Columns",
    min: 1,
    max: 12,
    step: 1
  },

  blur: {
    component: "slider",
    label: "Blur",
    min: 0,
    max: 20,
    step: 0.5
  },

  displacement: {
    component: "slider",
    label: "Displacement",
    min: 0,
    max: 1,
    step: 0.01
  },

  colorShift: {
    component: "slider",
    label: "Color shift",
    min: 0,
    max: 1,
    step: 0.01
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
