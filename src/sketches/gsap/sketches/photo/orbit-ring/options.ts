import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  count: 8,
  ringRadiusRatio: 0.62,
  cardWidthRatio: 0.22,
  cardAspect: 1.2,
  tilt: 0,
  perspective: 1600,
  upright: true,
  spins: 1,
  direction: "cw"
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  count: {
    component: "slider",
    label: "Card count",
    min: 2,
    max: 24,
    step: 1
  },
  ringRadiusRatio: {
    component: "slider",
    label: "Ring radius",
    min: 0.2,
    max: 1,
    step: 0.01
  },
  cardWidthRatio: {
    component: "slider",
    label: "Card width",
    min: 0.1,
    max: 0.5,
    step: 0.01
  },
  cardAspect: {
    component: "slider",
    label: "Card aspect (h/w)",
    min: 0.5,
    max: 2,
    step: 0.01
  },
  tilt: {
    component: "slider",
    label: "Tilt",
    min: -80,
    max: 80,
    step: 1
  },
  perspective: {
    component: "slider",
    label: "Perspective",
    min: 600,
    max: 3500,
    step: 10
  },
  upright: {
    component: "checkbox",
    label: "Keep cards upright"
  },
  spins: {
    component: "slider",
    label: "Turns per loop",
    min: 1,
    max: 4,
    step: 1
  },
  direction: {
    component: "select",
    label: "Direction",
    options: [
      {
        label: "Clockwise",
        value: "cw"
      },
      {
        label: "Counter-clockwise",
        value: "ccw"
      }
    ]
  }
};
