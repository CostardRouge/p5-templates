import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  rows: 4,
  margin: 0,
  rowGap: 16,
  itemAspect: 1.4,
  baseSpeed: 1,
  speedStep: 0,
  alternate: true,
  reverseAll: false
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  rows: {
    component: "slider",
    label: "Rows",
    min: 1,
    max: 10,
    step: 1
  },
  margin: {
    component: "slider",
    label: "Outer margin",
    min: 0,
    max: 320,
    step: 1
  },
  rowGap: {
    component: "slider",
    label: "Row gap",
    min: 0,
    max: 160,
    step: 1
  },
  itemAspect: {
    component: "slider",
    label: "Item aspect (w/h)",
    min: 0.5,
    max: 3,
    step: 0.01
  },
  baseSpeed: {
    component: "slider",
    label: "Base speed (loops)",
    min: 1,
    max: 8,
    step: 1
  },
  speedStep: {
    component: "slider",
    label: "Per-row speed step",
    min: 0,
    max: 4,
    step: 1
  },
  alternate: {
    component: "checkbox",
    label: "Alternate direction"
  },
  reverseAll: {
    component: "checkbox",
    label: "Reverse direction"
  }
};
