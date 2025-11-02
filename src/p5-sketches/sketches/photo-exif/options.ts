export const formValues = {
  margin: 0.1,
  center: true,
  fontSize: 20,
  fontColor: [
    0,
    0,
    0
  ],
  photo: null
};

export const formConfiguration: Record<string, any> = {
  margin: {
    label: "Image margin",
    component: "slider",
    min: 0,
    max: 0.45,
    step: 0.005
  },
  center: {
    label: "Image center",
    component: "checkbox",
  },
  fontSize: {
    component: "slider",
    label: "Font size",
    min: 1,
    max: 244
  },
  fontColor: {
    component: "color",
    label: "Font color"
  },
  photo: {
    component: "image",
    label: "Image"
  }
};
