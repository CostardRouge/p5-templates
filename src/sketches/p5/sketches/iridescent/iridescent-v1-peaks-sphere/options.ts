import {
  materialFormValues,
  materialFormConfiguration,
  backgroundFormValues,
  backgroundFormConfiguration,
  renderingFormValues,
  renderingFormConfiguration,
  rotationFormConfiguration
} from "../_form.js";

// peaks-sphere's geometry, verbatim (sphere / peaks / surface / noise /
// rotation), minus the disc-stack knobs; plus the body, the material, the
// background and the rendering blocks every iridescent sketch shares.
export const formValues = {
  sphere: {
    radiusX: 250,
    radiusY: 250,
    radiusZ: 250,
    meridians: 38,
    parallels: 10
  },
  peaks: {
    spikeLengthMax: 311,
    spikeLengthMin: 50,
    depthEasing: "easeOutQuad",
    point: {
      strokeWeightMin: 0.5,
      strokeWeightMax: 62,
      strokeWeightEasing: "easeOutQuint"
    }
  },
  surface: {
    noiseScale: 3.9,
    noiseSpeed: 0.41,
    animated: false,
    contrast: 2.57,
    contrastEasing: "easeInOutQuad",
    noiseOffset: 150
  },
  body: {
    enabled: true,
    scale: 0.6
  },
  rotation: {
    enabled: true,
    angleMax: 0.35,
    xMultiplier: 3,
    yMultiplier: 5,
    zMultiplier: 0,
    spinTurns: 2
  },
  noise: {
    seed: 4259,
    detail: 5,
    falloff: 0.43
  },
  material: materialFormValues,
  background: backgroundFormValues,
  rendering: renderingFormValues
};

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
        step: 1
      },
      radiusY: {
        label: "Radius Y",
        component: "slider",
        min: 10,
        max: 600,
        step: 1
      },
      radiusZ: {
        label: "Radius Z",
        component: "slider",
        min: 10,
        max: 600,
        step: 1
      },
      meridians: {
        label: "Meridians (longitude)",
        component: "slider",
        min: 1,
        max: 120,
        step: 1
      },
      parallels: {
        label: "Parallels (latitude)",
        component: "slider",
        min: 1,
        max: 60,
        step: 1
      }
    }
  },
  peaks: {
    component: "nested-object",
    label: "Peaks / Spikes",
    fields: {
      spikeLengthMax: {
        label: "Max spike length",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      spikeLengthMin: {
        label: "Min spike length",
        component: "slider",
        min: 0,
        max: 300,
        step: 1
      },
      depthEasing: {
        component: "easing",
        label: "Depth easing (the spike's taper along its length)"
      },
      point: {
        component: "nested-object",
        label: "Thickness",
        fields: {
          strokeWeightMin: {
            label: "Thickness at the tip",
            component: "slider",
            min: 0.5,
            max: 500,
            step: 0.5
          },
          strokeWeightMax: {
            label: "Thickness at the base",
            component: "slider",
            min: 0.5,
            max: 500,
            step: 0.5
          },
          strokeWeightEasing: {
            component: "easing",
            label: "Thickness easing"
          }
        }
      }
    }
  },
  surface: {
    component: "nested-object",
    label: "Surface deformation (terrain)",
    fields: {
      noiseScale: {
        label: "Noise scale",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      },
      noiseSpeed: {
        label: "Animation speed",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      animated: {
        label: "Animated?",
        component: "checkbox"
      },
      contrast: {
        label: "Contrast (height variation)",
        component: "slider",
        min: 0.1,
        max: 5,
        step: 0.01
      },
      contrastEasing: {
        component: "easing",
        label: "Contrast easing"
      },
      noiseOffset: {
        label: "Noise offset (shift pattern)",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.1
      }
    }
  },
  body: {
    component: "nested-object",
    label: "Body (the ellipsoid under the spikes)",
    fields: {
      enabled: {
        label: "Draw the body?",
        component: "checkbox"
      },
      scale: {
        label: "Body scale (× the sphere radii)",
        component: "slider",
        min: 0.5,
        max: 1.5,
        step: 0.01
      }
    }
  },
  rotation: rotationFormConfiguration,
  noise: {
    component: "nested-object",
    label: "Noise",
    fields: {
      seed: {
        label: "Seed",
        component: "slider",
        min: 0,
        max: 9999,
        step: 1
      },
      detail: {
        label: "Detail (octaves)",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      falloff: {
        label: "Falloff",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  material: materialFormConfiguration( {
    structureLabel: "Terrain height → colour"
  } ),
  background: backgroundFormConfiguration,
  rendering: renderingFormConfiguration
};
