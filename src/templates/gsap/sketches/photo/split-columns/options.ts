import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  columns: 4,
  margin: 0,
  colGap: 0,
  itemAspect: 0.75,
  baseSpeed: 2,
  speedStep: 0,
  alternate: true,
  reverseAll: false,
  parallax: 0.12
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  columns: {
    component: "slider",
    label: "Columns",
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
  colGap: {
    component: "slider",
    label: "Column gap",
    min: 0,
    max: 160,
    step: 1
  },
  itemAspect: {
    component: "slider",
    label: "Item aspect (w/h)",
    min: 0.4,
    max: 2,
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
    label: "Per-column speed step",
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
  },
  parallax: {
    component: "slider",
    label: "Depth falloff",
    min: 0,
    max: 0.6,
    step: 0.01
  }
};
