export const formValues = {
  colors: {
    background: [
      246,
      235,
      225
    ] as [number, number, number],
  },
};

export const formConfiguration: Record<string, any> = {
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
