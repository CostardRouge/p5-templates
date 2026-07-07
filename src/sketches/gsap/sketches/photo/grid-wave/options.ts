import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  grid: {
    rows: 4,
    columns: 4
  },
  margin: 64,
  amplitude: 0.08,
  depth: 80,
  shade: 0.35,
  cycles: 1,
  freqRow: 0.1,
  freqCol: 0.85,
  perspective: 600
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      rows: {
        component: "slider",
        label: "Rows",
        min: 1,
        max: 12,
        step: 1
      },
      columns: {
        component: "slider",
        label: "Columns",
        min: 1,
        max: 12,
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
  amplitude: {
    component: "slider",
    label: "Scale amplitude",
    min: 0,
    max: 0.4,
    step: 0.005
  },
  depth: {
    component: "slider",
    label: "Depth (Z)",
    min: 0,
    max: 400,
    step: 1
  },
  shade: {
    component: "slider",
    label: "Brightness wave",
    min: 0,
    max: 0.8,
    step: 0.01
  },
  cycles: {
    component: "slider",
    label: "Wave cycles per loop",
    min: 1,
    max: 6,
    step: 1
  },
  freqRow: {
    component: "slider",
    label: "Row frequency",
    min: 0,
    max: 2,
    step: 0.05
  },
  freqCol: {
    component: "slider",
    label: "Column frequency",
    min: 0,
    max: 2,
    step: 0.05
  },
  perspective: {
    component: "slider",
    label: "Perspective",
    min: 600,
    max: 3500,
    step: 10
  }
};
