import {
  blendSelectOptions
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

// Default values only
export const formValues = {
  videos: [
    {
      id: "test-gradient-flow",
      path: "/assets/videos/test/gradient-flow.mp4",
      params: {
        repeat: 1,
        speed: 4,
        offset: 0,
        loopMode: "loop",
        scale: 0.5,
        posX: 0,
        posY: 0,
        fit: "contain"
      }
    }
  ],

  decay: 0.71,
  zoom: 1.1,
  rotation: -2,
  blur: 1,
  blendMode: "source-over",

  backgroundColor: [
    10,
    10,
    12
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  videos: {
    component: "asset-stack",
    kind: "videos",
    label: "Videos"
  },

  decay: {
    component: "slider",
    label: "Trail persistence",
    min: 0,
    max: 0.99,
    step: 0.01
  },

  zoom: {
    component: "slider",
    label: "Feedback zoom",
    min: 0.9,
    max: 1.1,
    step: 0.005
  },

  rotation: {
    component: "slider",
    label: "Feedback rotation (deg/frame)",
    min: -5,
    max: 5,
    step: 0.1
  },

  blur: {
    component: "slider",
    label: "Blur",
    min: 0,
    max: 6,
    step: 1
  },

  blendMode: {
    component: "select",
    label: "Blend mode",
    options: blendSelectOptions
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
