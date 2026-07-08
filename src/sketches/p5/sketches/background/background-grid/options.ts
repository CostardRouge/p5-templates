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
  columns: 12,
  proportional: true,
  rows: 12,
  strokeWeight: 1,
  border: false
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
  strokeWeight: {
    label: "Line weight",
    component: "slider",
    min: 0.1,
    max: 20,
    step: 0.1
  },
  border: {
    label: "Draw outer border?",
    component: "checkbox"
  }
};
