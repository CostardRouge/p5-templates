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
  columns: 24,
  proportional: true,
  rows: 24,
  dotSize: 6,
  pulse: 0,
  border: false
};

export const formConfiguration: Record<string, any> = {
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  color: {
    component: "color",
    label: "Dot color"
  },
  columns: {
    label: "Columns",
    component: "slider",
    min: 1,
    max: 120,
    step: 1
  },
  proportional: {
    label: "Proportional rows?",
    component: "checkbox"
  },
  rows: {
    label: "Rows",
    component: "slider",
    min: 1,
    max: 200,
    step: 1
  },
  dotSize: {
    label: "Dot size",
    component: "slider",
    min: 1,
    max: 40,
    step: 0.5
  },
  pulse: {
    label: "Size pulse (0 = static)",
    component: "slider",
    min: 0,
    max: 1,
    step: 0.05
  },
  border: {
    label: "Include edge dots?",
    component: "checkbox"
  }
};
