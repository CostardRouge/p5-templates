import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  peaks: {
    layers: 87,
    spikeLengthMax: 427,
    spikeLengthEasing: "easeInQuad",
    baseHeightMax: 400,
    baseHeightEasing: "easeInQuad",
    depthEasing: "easeOutQuad",
    point: {
      strokeWeightMin: 19.5,
      strokeWeightMax: 50,
      strokeWeightEasing: "easeOutQuart",
    },
  },
  lod: {
    enabled: true,
    minLayers: 7,
  },
  field: {
    xScale: 3,
    yScale: 2.6,
    heightOffset: 60.1,
    terrainOffset: 116.2,
    animSpeed: 0.1,
    animated: false,
  },
  grid: {
    proportional: true,
    columns: 27,
    rows: 30,
  },
  backgroundColor: [
    0,
    0,
    0,
  ],
  rotation: {
    enabled: true,
    xBase: -1.01159265358979,
    yBase: -0.391592653589793,
    angleMax: 0.21,
    xMultiplier: -3,
    yMultiplier: 3,
    zMultiplier: 1,
  },
  colors: {
    opacityMax: 5.4,
    opacityMin: 0.5,
    opacityEasing: "easeInCirc",
    layerProgressionMultiplier: 0.8,
    heightProgressionMultiplier: 0,
    hueIndexMultiplier: 5,
    hueHeightMixing: 0.57,
    hueIndexEasing: "easeOutSine",
    hueOffset: 0.108407346410207,
  },
  noise: {
    seed: 42,
    detail: 4,
    falloff: 0.5,
    xMultiplier: 2,
    yMultiplier: 2,
    layerProgressionMultiplier: 0.3,
    animMultiplier: 0.5,
  },
  title: {
    ...titleDefaultValues,
    show: false,
  },
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  peaks: {
    component: "nested-object",
    label: "Peaks",
    fields: {
      layers: {
        label: "Max layers per spike",
        component: "slider",
        min: 1,
        max: 300,
        step: 1,
      },
      spikeLengthMax: {
        label: "Max spike length",
        component: "slider",
        min: 0,
        max: 800,
        step: 1,
      },
      spikeLengthEasing: {
        component: "easing",
        label: "Spike length easing",
      },
      baseHeightMax: {
        label: "Max terrain height offset",
        component: "slider",
        min: 0,
        max: 400,
        step: 1,
      },
      baseHeightEasing: {
        component: "easing",
        label: "Terrain height easing",
      },
      depthEasing: {
        component: "easing",
        label: "Depth distribution easing",
      },
      point: {
        component: "nested-object",
        label: "Point settings",
        fields: {
          strokeWeightMin: {
            label: "Stroke weight (tip)",
            component: "slider",
            min: 0.5,
            max: 500,
            step: 0.5,
          },
          strokeWeightMax: {
            label: "Stroke weight (base)",
            component: "slider",
            min: 0.5,
            max: 500,
            step: 0.5,
          },
          strokeWeightEasing: {
            component: "easing",
            label: "Stroke weight easing",
          },
        },
      },
    },
  },
  lod: {
    component: "nested-object",
    label: "Level of Detail (LOD)",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox",
      },
      minLayers: {
        label: "Min layers (shortest spikes)",
        component: "slider",
        min: 1,
        max: 30,
        step: 1,
      },
    },
  },
  field: {
    component: "nested-object",
    label: "Spatial field",
    fields: {
      xScale: {
        label: "Field X scale",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1,
      },
      yScale: {
        label: "Field Y scale",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1,
      },
      heightOffset: {
        label: "Height field noise offset",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.1,
      },
      terrainOffset: {
        label: "Terrain field noise offset",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.1,
      },
      animSpeed: {
        label: "Animation speed",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01,
      },
      animated: {
        label: "Animated?",
        component: "checkbox",
      },
    },
  },
  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      proportional: {
        label: "Proportional rows?",
        component: "checkbox",
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 2,
        max: 60,
        step: 1,
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 2,
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
        label: "Animated wobble?",
        component: "checkbox",
      },
      xBase: {
        label: "Base X tilt (view angle)",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
      },
      yBase: {
        label: "Base Y tilt",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
      },
      angleMax: {
        label: "Wobble amplitude",
        component: "slider",
        min: 0,
        max: Math.PI,
        step: 0.01,
      },
      xMultiplier: {
        label: "X wobble speed",
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1,
      },
      yMultiplier: {
        label: "Y wobble speed",
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1,
      },
      zMultiplier: {
        label: "Z wobble speed",
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1,
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
        min: 0,
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
        label: "Opacity easing",
      },
      layerProgressionMultiplier: {
        label: "Layer progression multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1,
      },
      heightProgressionMultiplier: {
        label: "Height progression multiplier",
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
      hueHeightMixing: {
        label: "Hue–height mixing",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      hueIndexEasing: {
        component: "easing",
        label: "Hue index easing",
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
      layerProgressionMultiplier: {
        label: "Layer progression multiplier",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01,
      },
      animMultiplier: {
        label: "Noise animation multiplier",
        component: "slider",
        min: 0,
        max: 5,
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
