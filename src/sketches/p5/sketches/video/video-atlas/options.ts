import {
  webcamSourceFormConfiguration,
  webcamSourceFormValues
} from "@/p5/utils/webcam/defaults.js";

// Default values only
export const formValues = {
  // Live camera source — the shared webcam-device-select picker. The webcam is
  // owned by MediaPipe here (it also runs the segmentation), so flip is applied
  // by the sketch rather than the capture.
  camera: {
    ...webcamSourceFormValues,
    // Lighter capture keeps the (main-thread) segmenter responsive; the cutout
    // is downscaled into the echo ring anyway.
    width: 640,
    height: 480
  },

  // How many echo layers the stack holds (the depth of the trail).
  layers: 24,

  // Per-layer transform — each older layer is pushed further along this offset,
  // grown a touch and twisted slightly, which fans movement into ribbons.
  offset: {
    x: 6,
    y: -8
  },
  scaleStep: 0.006,
  rotateStep: 0.4,

  // Depth gradient: front = newest (real colours), shifting through mid into
  // back as layers recede.
  frontColor: [
    255,
    240,
    230
  ],
  midColor: [
    255,
    90,
    170
  ],
  backColor: [
    70,
    110,
    255
  ],

  // Flat saturated backdrop.
  backgroundColor: [
    240,
    52,
    40
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  camera: webcamSourceFormConfiguration,

  layers: {
    component: "slider",
    label: "Echo layers",
    min: 2,
    max: 36,
    step: 1
  },

  offset: {
    component: "vector2d",
    label: "Layer offset (px)",
    min: -40,
    max: 40,
    step: 1,
    yDown: true
  },

  scaleStep: {
    component: "slider",
    label: "Layer growth",
    min: 0,
    max: 0.02,
    step: 0.001
  },

  rotateStep: {
    component: "slider",
    label: "Layer twist (°)",
    min: -2,
    max: 2,
    step: 0.1
  },

  frontColor: {
    component: "color",
    label: "Front colour (newest)"
  },

  midColor: {
    component: "color",
    label: "Mid colour"
  },

  backColor: {
    component: "color",
    label: "Back colour (oldest)"
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
