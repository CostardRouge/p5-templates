export const formValues = {
  colors: {
    background: [
      246,
      235,
      225
    ] as [number, number, number],
    text: [
      0
    ] as [number]
  }
};

export const formConfiguration: Record<string, any> = {
  colors: {
    label: "Colors",
    component: "nested-object",
    fields: {
      background: {
        component: "color",
        label: "Background color"
      },
      text: {
        component: "color",
        label: "Text color"
      }
    }
  }
};
