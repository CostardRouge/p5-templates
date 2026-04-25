import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  peaks: {
    depthLayersCount: 118,
    depthEasing: "easeOutQuad",
    point: {
      strokeWeightMax: 194,
      strokeWeightMin: 41,
      strokeWeightEasing: "easeInSine",
    },
  },
  cylinder: {
    radius: 81,
    height: 684,
    spikeLength: 288,
    columns: 14,
    rows: 6,
  },
  backgroundColor: [
    0,
    0,
    0
  ],
  rotation: {
    enabled: true,
    angleMax: 0.6,
    xMultiplier: 3,
    yMultiplier: 3,
    zMultiplier: 0,
  },
  colors: {
    opacityMax: 4,
    opacityMin: 1,
    opacityEasing: "easeOutCirc",
    progressionMultiplier: 1,
    layerProgressionMultiplier: 1,
    hueIndexMultiplier: 6.2,
    hueIndexEasing: "easeOutSine",
    hueOffset: 0,
  },
  noise: {
    seed: 620,
    detail: 4,
    falloff: 0.5,
    xMultiplier: 1,
    yMultiplier: 1,
    progressionMultiplier: 0,
    layerProgressionMultiplier: 0.51,
  },
  title: {
    ...titleDefaultValues,
    show: false
  },
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  peaks: {
    component: "nested-object",
    label: "Peaks",
    fields: {
      depthLayersCount: {
        label: "Depth layers count",
        component: "slider",
        min: 1,
        max: 1000,
        step: 1,
      },
      depthEasing: {
        component: "easing",
        label: "Depth easing function",
      },
      point: {
        component: "nested-object",
        label: "Point settings",
        fields: {
          strokeWeightMax: {
            label: "Start stroke weight",
            component: "slider",
            min: 1,
            max: 350,
            step: 1,
          },
          strokeWeightMin: {
            label: "End stroke weight",
            component: "slider",
            min: 1,
            max: 350,
            step: 1,
          },
          strokeWeightEasing: {
            component: "easing",
            label: "Stroke weight easing function",
          },
        },
      },
    },
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1,
      },
      opacityMin: {
        label: "Opacity min",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1,
      },
      opacityEasing: {
        component: "easing",
        label: "Opacity easing function",
      },
      progressionMultiplier: {
        label: "Progression multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1,
      },
      layerProgressionMultiplier: {
        label: "Layer progression multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1,
      },
      hueIndexMultiplier: {
        label: "Hue index multiplier",
        component: "slider",
        min: 1,
        max: 16,
        step: 0.1,
      },
      hueIndexEasing: {
        component: "easing",
        label: "Hue index easing function",
      },
      hueOffset: {
        label: "Hue offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
      },
    },
  },
  cylinder: {
    component: "nested-object",
    label: "Cylinder",
    fields: {
      radius: {
        label: "Radius",
        component: "slider",
        min: 10,
        max: 800,
        step: 1,
      },
      height: {
        label: "Height",
        component: "slider",
        min: 10,
        max: 1200,
        step: 1,
      },
      spikeLength: {
        label: "Spike length",
        component: "slider",
        min: 0,
        max: 600,
        step: 1,
      },
      columns: {
        label: "Columns (around)",
        component: "slider",
        min: 2,
        max: 120,
        step: 1,
      },
      rows: {
        label: "Rows (height)",
        component: "slider",
        min: 1,
        max: 60,
        step: 1,
      },
    },
  },
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox",
      },
      angleMax: {
        label: "Angle max",
        component: "slider",
        min: 0,
        max: Math.PI,
        step: 0.01,
      },
      xMultiplier: {
        label: "X angle multiplier",
        component: "slider",
        min: -9,
        max: 9,
      },
      yMultiplier: {
        label: "Y angle multiplier",
        component: "slider",
        min: -9,
        max: 9,
      },
      zMultiplier: {
        label: "Z angle multiplier",
        component: "slider",
        min: -9,
        max: 9,
      },
    },
  },
  noise: {
    component: "nested-object",
    label: "Noise",
    fields: {
      seed: {
        label: "Seed",
        component: "slider",
        min: 0,
        max: 9999,
        step: 1,
      },
      detail: {
        label: "Detail (octaves)",
        component: "slider",
        min: 1,
        max: 8,
        step: 1,
      },
      falloff: {
        label: "Falloff",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      xMultiplier: {
        label: "X multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01,
      },
      yMultiplier: {
        label: "Y multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01,
      },
      progressionMultiplier: {
        label: "Progression multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01,
      },
      layerProgressionMultiplier: {
        label: "Layer progression multiplier",
        component: "slider",
        min: 0,
        max: 10,
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
