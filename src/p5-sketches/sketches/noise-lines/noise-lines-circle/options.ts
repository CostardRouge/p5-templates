import titleFormConfiguration from "@/p5-sketches/utils/title/titleFormConfiguration";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";

export const formValues = {
  shape: {
    stroke: [
      0
    ],
    strokeWeight: 1,
    linesCount: 150,
    radiusOffsetMultiplier: 2,
    noisePhaseMultiplier: 0.02,
    baseRadius: 150,
    roughness: 1.5,
    magnitude: 50,
    incrementStep: 0.05,
    zOffSpeed: 0.005,
  },
  backgroundColor: [
    246,
    235,
    225
  ],
  title: titleDefaultValues,
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      stroke: {
        label: "Stroke",
        component: "color",
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1,
      },
      linesCount: {
        label: "Lines count",
        component: "slider",
        min: 1,
        max: 1000,
        step: 1,
      },
      radiusOffsetMultiplier: {
        label: "Radius offset multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1,
      },
      noisePhaseMultiplier: {
        label: "Noise phase multiplier",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.001,
      },
      baseRadius: {
        label: "Base radius",
        component: "slider",
        min: 10,
        max: 500,
        step: 0.1,
      },
      roughness: {
        label: "Roughness",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1,
      },
      magnitude: {
        label: "Magnitude",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.1,
      },
      zOffSpeed: {
        label: "Z offset speed",
        component: "slider",
        min: -0.1,
        max: 0.1,
        step: 0.001,
      },
      incrementStep: {
        label: "Increment step",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01,
      },
    },
  },
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
};
