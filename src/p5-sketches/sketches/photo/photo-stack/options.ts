export const formValues = {
  shiftMargin: 80,
  randomPosition: true,
  imageMargin: 80,
  colors: {
    background: [
      246,
      235,
      225
    ],
  },
};

export const formConfiguration: Record<string, any> = {
  shiftMargin: {
    label: "Shift margin",
    component: "slider",
    min: 0,
    max: 200,
    step: 5,
  },
  randomPosition: {
    label: "Random position",
    component: "checkbox",
  },
  imageMargin: {
    label: "Image margin",
    component: "slider",
    min: 0,
    max: 200,
    step: 5,
  },
  colors: {
    label: "Colors",
    component: "nested-object",
    fields: {
      background: {
        component: "color",
        label: "Background color",
      },
    },
  },
};
