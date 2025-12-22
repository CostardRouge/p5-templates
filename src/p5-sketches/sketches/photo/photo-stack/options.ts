export const formValues = {
  images: [
  ],

  margin: 0.1,
  scale: 1,
  center: true,
  clip: false,
  fill: false,

  randomMargin: 80,

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
  randomMargin: {
    label: "Random margin",
    component: "slider",
    min: 0,
    max: 1500,
    step: 1,
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
    label: "Center image",
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
