import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  maxCards: 7,
  cardWidthRatio: 0.46,
  cardAspect: 1.4,
  spread: 70,
  lift: 0.08,
  holdFraction: 0.25
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  maxCards: {
    component: "slider",
    label: "Card count",
    min: 2,
    max: 12,
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
  spread: {
    component: "slider",
    label: "Fan spread",
    min: 0,
    max: 160,
    step: 1
  },
  lift: {
    component: "slider",
    label: "Lift",
    min: 0,
    max: 0.5,
    step: 0.01
  },
  holdFraction: {
    component: "slider",
    label: "Hold portion",
    min: 0,
    max: 0.8,
    step: 0.01
  }
};
