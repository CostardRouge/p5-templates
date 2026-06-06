import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  maxCards: 6,
  cardWidthRatio: 0.62,
  cardAspect: 1.3,
  offsetX: 18,
  offsetY: 24,
  rotationJitter: 4,
  scaleStep: 0.05,
  depthStep: 60,
  dimStep: 0.08,
  perspective: 1600,
  seed: 7,
  direction: "left",
  throw: {
    x: 0.7,
    y: 0.4,
    rotate: 18,
    scale: 0.08
  }
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
  offsetX: {
    component: "slider",
    label: "Stack offset X",
    min: 0,
    max: 120,
    step: 1
  },
  offsetY: {
    component: "slider",
    label: "Stack offset Y",
    min: 0,
    max: 120,
    step: 1
  },
  rotationJitter: {
    component: "slider",
    label: "Rotation jitter",
    min: 0,
    max: 20,
    step: 0.5
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
  perspective: {
    component: "slider",
    label: "Perspective",
    min: 600,
    max: 3500,
    step: 10
  },
  direction: {
    component: "select",
    label: "Throw direction",
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
  },
  throw: {
    component: "nested-object",
    label: "Throw",
    fields: {
      x: {
        component: "slider",
        label: "Distance X",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      y: {
        component: "slider",
        label: "Lift Y",
        min: 0,
        max: 1,
        step: 0.01
      },
      rotate: {
        component: "slider",
        label: "Rotate",
        min: 0,
        max: 60,
        step: 1
      },
      scale: {
        component: "slider",
        label: "Scale boost",
        min: 0,
        max: 0.4,
        step: 0.01
      }
    }
  },
  seed: {
    component: "slider",
    label: "Seed",
    min: 1,
    max: 999,
    step: 1
  }
};
