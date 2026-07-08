import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  maxCards: 5,
  cardWidthRatio: 0.6,
  cardAspect: 1.3,
  offsetY: 22,
  scaleStep: 0.04,
  depthStep: 60,
  dimStep: 0.08,
  peelAngle: 160,
  perspective: 1600
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  maxCards: {
    component: "slider",
    label: "Deck size",
    min: 2,
    max: 12,
    step: 1
  },
  cardWidthRatio: {
    component: "slider",
    label: "Card width",
    min: 0.3,
    max: 0.95,
    step: 0.01
  },
  cardAspect: {
    component: "slider",
    label: "Card aspect (h/w)",
    min: 0.5,
    max: 2,
    step: 0.01
  },
  offsetY: {
    component: "slider",
    label: "Stack offset Y",
    min: 0,
    max: 120,
    step: 1
  },
  scaleStep: {
    component: "slider",
    label: "Depth scale step",
    min: 0,
    max: 0.15,
    step: 0.005
  },
  depthStep: {
    component: "slider",
    label: "Depth Z step",
    min: 0,
    max: 200,
    step: 1
  },
  dimStep: {
    component: "slider",
    label: "Depth dim step",
    min: 0,
    max: 0.2,
    step: 0.005
  },
  peelAngle: {
    component: "slider",
    label: "Peel angle",
    min: 60,
    max: 180,
    step: 1
  },
  perspective: {
    component: "slider",
    label: "Perspective",
    min: 600,
    max: 3500,
    step: 10
  }
};
