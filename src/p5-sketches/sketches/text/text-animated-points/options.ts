export const formValues = {
  shape: {
    text: "x",
    size: 1,
    sampleFactor: 0.1,
    simplifyThreshold: 0,
  },
  color: {
    opacityFactor: 1.5,
    fillAlphaStart: 240,
    fillAlphaEnd: 0,
    strokeAlpha: 200,
    hueMultiplier: 2,
  },
  backgroundColor: [
    246,
    235,
    225
  ],
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      text: {
        label: "Text",
        component: "text",
      },
      size: {
        label: "Size",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      sampleFactor: {
        label: "Text sample factor",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01
      },
      simplifyThreshold: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
    }
  },
  color: {
    component: "nested-object",
    label: "Color",
    fields: {
      opacityFactor: {
        label: "Opacity factor",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.1
      },
      fillAlphaStart: {
        label: "Fill alpha (visible)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      fillAlphaEnd: {
        label: "Fill alpha (hidden)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      strokeAlpha: {
        label: "Stroke alpha",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      hueMultiplier: {
        label: "Hue range multiplier",
        component: "slider",
        min: 0.5,
        max: 5,
        step: 0.1
      },
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
};
