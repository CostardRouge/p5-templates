export const formValues = {
  headline: "Made with GSAP",
  subtitle: "HTML · CSS · GSAP — recorded frame-perfect",
  headlineSize: 132,
  backgroundColor: [
    11,
    11,
    18
  ],
  textColor: [
    255,
    255,
    255
  ],
  accentColor: [
    124,
    92,
    255
  ]
};

export const formConfiguration: Record<string, any> = {
  headline: {
    component: "text",
    label: "Headline"
  },
  subtitle: {
    component: "text",
    label: "Subtitle"
  },
  headlineSize: {
    component: "slider",
    label: "Headline size",
    min: 48,
    max: 240,
    step: 1
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  textColor: {
    component: "color",
    label: "Text color"
  },
  accentColor: {
    component: "color",
    label: "Accent color"
  }
};
