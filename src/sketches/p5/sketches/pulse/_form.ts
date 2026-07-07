export const layoutFormConfiguration = {
  component: "nested-object",
  label: "Layout",
  fields: {
    xCount: {
      label: "X count",
      component: "slider",
      min: 1,
      max: 20,
      step: 1
    },
    yCount: {
      label: "Y count",
      component: "slider",
      min: 1,
      max: 20,
      step: 1
    },
    sizeDivisor: {
      label: "Size divisor",
      component: "slider",
      min: 1,
      max: 12,
      step: 0.1
    }
  }
};
