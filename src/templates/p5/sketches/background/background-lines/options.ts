export const formValues = {
  backgroundColor: [
    0,
    0,
    0
  ],
  color: [
    255,
    255,
    255
  ],
  columnsMin: 2,
  columnsMax: 8,
  weight: 6,
  overshoot: 0,
  easing: "easeInOutBack"
};

export const formConfiguration: Record<string, any> = {
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  color: {
    component: "color",
    label: "Line color"
  },
  columnsMin: {
    label: "Min lines",
    component: "slider",
    min: 1,
    max: 40,
    step: 1
  },
  columnsMax: {
    label: "Max lines",
    component: "slider",
    min: 1,
    max: 80,
    step: 1
  },
  weight: {
    label: "Line weight",
    component: "slider",
    min: 0,
    max: 30,
    step: 0.5
  },
  overshoot: {
    label: "Vertical overshoot (px)",
    component: "slider",
    min: 0,
    max: 400,
    step: 10
  },
  easing: {
    component: "easing",
    label: "Drift easing"
  }
};
