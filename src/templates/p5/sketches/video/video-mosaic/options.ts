import {
  webcamSourceFormConfiguration,
  webcamSourceFormValues
} from "@/p5/utils/webcam/defaults.js";

// Default values only
export const formValues = {
  // Live camera source — the shared webcam-device-select picker. The camera is
  // owned by MediaPipe (it also runs the optional hand tracking), so flip is
  // applied by the sketch rather than the capture.
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

  // How the per-cell displacement is driven: "auto" (drifting noise) or
  // "interactive" (pulled toward the mouse + detected fingertips on the same
  // camera).
  displacementMode: "auto",
  // How far a pointer's pull reaches, as a fraction of the canvas (interactive).
  reach: 0.5,

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
    max: 32,
    step: 1
  },

  columns: {
    component: "slider",
    label: "Columns",
    min: 1,
    max: 32,
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
    max: 10,
    step: 0.01
  },

  colorShift: {
    component: "slider",
    label: "Color shift",
    min: 0,
    max: 1,
    step: 0.01
  },

  displacementMode: {
    component: "select",
    label: "Displacement",
    options: [
      {
        label: "Automatic (drift)",
        value: "auto"
      },
      {
        label: "Interactive (mouse + fingers)",
        value: "interactive"
      }
    ]
  },

  reach: {
    component: "slider",
    label: "Interaction reach",
    min: 0.05,
    max: 1,
    step: 0.01
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
