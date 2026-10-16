// The studio's global `colors.background` (options.json) stays the fallback; the
// sketch's own field is what the form shows, so the background can be a gradient.
export const formValues = {
  backgroundColor: [
    0,
    0,
    0
  ]
};

export const formConfiguration: Record<string, any> = {
  backgroundColor: {
    component: "background",
    label: "Background color"
  }
};
