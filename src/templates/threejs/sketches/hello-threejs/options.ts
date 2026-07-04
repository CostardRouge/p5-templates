export const formValues = {
  color: [
    124,
    92,
    255
  ],
  accentColor: [
    80,
    170,
    255
  ],
  backgroundColor: [
    11,
    11,
    18
  ],
  spin: 1,
  pulse: 0.08,
  metalness: 0.4,
  roughness: 0.25,
  cameraDistance: 5,
  knotP: 2,
  knotQ: 3,
  wireframe: false
};

export const formConfiguration: Record<string, any> = {
  color: {
    component: "color",
    label: "Knot color"
  },
  accentColor: {
    component: "color",
    label: "Rim light color"
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  spin: {
    component: "slider",
    label: "Spin (turns per loop)",
    min: 0,
    max: 6,
    step: 1
  },
  pulse: {
    component: "slider",
    label: "Pulse",
    min: 0,
    max: 0.5,
    step: 0.01
  },
  metalness: {
    component: "slider",
    label: "Metalness",
    min: 0,
    max: 1,
    step: 0.01
  },
  roughness: {
    component: "slider",
    label: "Roughness",
    min: 0,
    max: 1,
    step: 0.01
  },
  cameraDistance: {
    component: "slider",
    label: "Camera distance",
    min: 3,
    max: 10,
    step: 0.1
  },
  knotP: {
    component: "slider",
    label: "Knot P",
    min: 1,
    max: 8,
    step: 1
  },
  knotQ: {
    component: "slider",
    label: "Knot Q",
    min: 1,
    max: 8,
    step: 1
  },
  wireframe: {
    component: "checkbox",
    label: "Wireframe"
  }
};
