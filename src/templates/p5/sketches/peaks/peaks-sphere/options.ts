import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  sphere: {
    radiusX: 242,
    radiusY: 200,
    radiusZ: 175,
    meridians: 13,
    parallels: 13,
  },
  peaks: {
    layers: 152,
    spikeLengthMax: 396,
    spikeLengthMin: 16,
    depthEasing: "easeOutQuad",
    point: {
      strokeWeightMin: 24,
      strokeWeightMax: 50,
      strokeWeightEasing: "easeInOutQuad",
    },
  },
  surface: {
    noiseScale: 6.3,
    noiseSpeed: 1.1,
    animated: true,
    contrast: 2.52,
    contrastEasing: "easeInQuad",
    noiseOffset: 115.1,
  },
  lod: {
    enabled: true,
    minLayers: 1,
  },
  backgroundColor: [ 205, 24, 24, 255 ],
  rotation: {
    enabled: true,
    angleMax: 0.6,
    xMultiplier: 1,
    yMultiplier: 2,
    zMultiplier: 0,
  },
  colors: {
    opacityMax: 2.9,
    opacityMin: 0.5,
    opacityEasing: "easeInCirc",
    progressionMultiplier: 2,
    layerProgressionMultiplier: 1,
    hueIndexMultiplier: 5,
    hueSurfaceMixing: 0.22,
    hueIndexEasing: "easeOutSine",
    hueOffset: 0,
  },
  noise: {
    seed: 42,
    detail: 4,
    falloff: 0.5,
    xMultiplier: 1,
    yMultiplier: 1,
    layerProgressionMultiplier: 0.4,
    animMultiplier: 0.3,
  },
  title: {
    ...titleDefaultValues,
    show: false,
  },
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  sphere: {
    component: "nested-object",
    label: "Sphere shape",
    fields: {
      radiusX: {
        label: "Radius X",
        component: "slider",
        min: 10,
        max: 600,
        step: 1,
      },
      radiusY: {
        label: "Radius Y",
        component: "slider",
        min: 10,
        max: 600,
        step: 1,
      },
      radiusZ: {
        label: "Radius Z",
        component: "slider",
        min: 10,
        max: 600,
        step: 1,
      },
      meridians: {
        label: "Meridians (longitude)",
        component: "slider",
        min: 3,
        max: 120,
        step: 1,
      },
      parallels: {
        label: "Parallels (latitude)",
        component: "slider",
        min: 3,
        max: 60,
        step: 1,
      },
    },
  },
  peaks: {
    component: "nested-object",
    label: "Peaks / Spikes",
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
        max: 600,
        step: 1,
      },
      spikeLengthMin: {
        label: "Min spike length",
        component: "slider",
        min: 0,
        max: 300,
        step: 1,
      },
      depthEasing: {
        component: "easing",
        label: "Depth easing",
      },
      point: {
        component: "nested-object",
        label: "Point settings",
        fields: {
          strokeWeightMin: {
            label: "Stroke weight (tip)",
            component: "slider",
            min: 0.5,
            max: 50,
            step: 0.5,
          },
          strokeWeightMax: {
            label: "Stroke weight (base)",
            component: "slider",
            min: 0.5,
            max: 50,
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
  surface: {
    component: "nested-object",
    label: "Surface deformation",
    fields: {
      noiseScale: {
        label: "Noise scale",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1,
      },
      noiseSpeed: {
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
      contrast: {
        label: "Contrast (height variation)",
        component: "slider",
        min: 0.1,
        max: 5,
        step: 0.01,
      },
      contrastEasing: {
        component: "easing",
        label: "Contrast easing",
      },
      noiseOffset: {
        label: "Noise offset (shift pattern)",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.1,
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
      hueSurfaceMixing: {
        label: "Hue–surface mixing",
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
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      enabled: {
        label: "Animated wobble?",
        component: "checkbox",
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
        label: "Color animation multiplier",
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
