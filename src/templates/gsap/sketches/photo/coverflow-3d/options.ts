import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  count: 8,
  cardWidthRatio: 0.22,
  cardAspect: 2,
  radiusFactor: 0.89,
  perspective: 1630,
  tilt: -13,
  spinMode: "continuous",
  spins: 1,
  direction: "right"
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  count: {
    component: "slider",
    label: "Card count",
    min: 3,
    max: 20,
    step: 1
  },
  cardWidthRatio: {
    component: "slider",
    label: "Card width",
    min: 0.2,
    max: 0.9,
    step: 0.01
  },
  cardAspect: {
    component: "slider",
    label: "Card aspect (h/w)",
    min: 0.5,
    max: 2,
    step: 0.01
  },
  radiusFactor: {
    component: "slider",
    label: "Ring radius",
    min: 0.5,
    max: 2.5,
    step: 0.01
  },
  perspective: {
    component: "slider",
    label: "Perspective",
    min: 600,
    max: 3500,
    step: 10
  },
  tilt: {
    component: "slider",
    label: "Tilt",
    min: -45,
    max: 45,
    step: 1
  },
  spinMode: {
    component: "select",
    label: "Spin mode",
    options: [
      {
        label: "Continuous",
        value: "continuous"
      },
      {
        label: "Stepped",
        value: "stepped"
      }
    ]
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
        label: "Left",
        value: "left"
      },
      {
        label: "Right",
        value: "right"
      }
    ]
  }
};
