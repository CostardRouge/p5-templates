export const formValues = {
  images: [
  ],
  margin: 0.1,
  scale: 1,
  center: true,
  clip: false,
  fill: false,
  backgroundColor: [
    246,
    235,
    225
  ],
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images",
  },
  margin: {
    label: "Image margin",
    component: "slider",
    min: 0,
    max: 0.45,
    step: 0.005,
  },
  scale: {
    label: "Scale",
    component: "slider",
    min: 0.1,
    max: 4,
    step: 0.1,
  },
  center: {
    label: "Center",
    component: "checkbox",
  },
  clip: {
    label: "Clip",
    component: "checkbox",
  },
  fill: {
    label: "Fill",
    component: "checkbox",
  },
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
};
