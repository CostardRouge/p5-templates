export const defaults = {
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

export const hints: Record<string, any> = {
  margin: {
    label: "Image margin",
    component: "slider",
    min: 0,
    max: 0.45,
    step: 0.005
  },
  "position.x": {
    step: 0.01,
    min: 0,
    max: 1
  },
  "position.y": {
    step: 0.01,
    min: 0,
    max: 1
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
