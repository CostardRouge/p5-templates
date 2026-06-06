import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  cornerRadius: 0,
  grid: {
    rows: 5,
    columns: 5
  },
  margin: 64,
  scatter: 0.35,
  rotate: 35,
  scaleVar: 0.35,
  seed: 11
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  grid: {
    component: "nested-object",
    label: "Tiles",
    fields: {
      rows: {
        component: "slider",
        label: "Rows",
        min: 1,
        max: 16,
        step: 1
      },
      columns: {
        component: "slider",
        label: "Columns",
        min: 1,
        max: 16,
        step: 1
      }
    }
  },
  margin: {
    component: "slider",
    label: "Outer margin",
    min: 0,
    max: 320,
    step: 1
  },
  scatter: {
    component: "slider",
    label: "Scatter amount",
    min: 0,
    max: 1,
    step: 0.01
  },
  rotate: {
    component: "slider",
    label: "Scatter rotation",
    min: 0,
    max: 180,
    step: 1
  },
  scaleVar: {
    component: "slider",
    label: "Scatter scale",
    min: 0,
    max: 0.9,
    step: 0.01
  },
  seed: {
    component: "slider",
    label: "Seed",
    min: 1,
    max: 999,
    step: 1
  }
};
