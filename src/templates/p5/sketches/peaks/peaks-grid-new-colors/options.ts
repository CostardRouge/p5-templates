import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  peaks: {
    depthLayersCount: 90,
    depthLengthMultiplier: 1,
    depthEasing: "easeInOutSine",
    point: {
      strokeWeightMax: 9,
      strokeWeightMin: 104,
      strokeWeightEasing: "easeInSine"
    }
  },
  grid: {
    proportional: true,
    columns: 7,
    rows: 12
  },
  backgroundColor: [
    0,
    0,
    0
  ],
  rotation: {
    enabled: false,
    angleMax: 1.17,
    xMultiplier: 2,
    yMultiplier: 3,
    zMultiplier: 0
  },
  colors: {
    opacityMax: 8.6,
    opacityMin: 3.7,
    opacityEasing: "easeInSine",
    progressionMultiplier: 0.7000000000000001,
    layerProgressionMultiplier: 6.1000000000000005,
    hueIndexMultiplier: 2.8000000000000003,
    hueIndexEasing: "easeOutSine",
    hueOffset: -0.03
  },
  noise: {
    seed: 2813,
    detail: 2,
    falloff: 1,
    xMultiplier: 0,
    yMultiplier: 0,
    progressionMultiplier: 0,
    layerProgressionMultiplier: 0.06
  },
  title: {
    ...titleDefaultValues,
    show: false
  }
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
        step: 1
      },
      depthLengthMultiplier: {
        label: "Depth length",
        component: "slider",
        min: -50,
        max: 50,
        step: 0.01
      },
      depthEasing: {
        component: "easing",
        label: "Depth easing function"
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
            step: 1
          },
          strokeWeightMin: {
            label: "End stroke weight",
            component: "slider",
            min: 1,
            max: 350,
            step: 1
          },
          strokeWeightEasing: {
            component: "easing",
            label: "Stroke weight easing function"
          }
        }
      }
    }
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
        step: 0.1
      },
      opacityMin: {
        label: "Opacity min",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      opacityEasing: {
        component: "easing",
        label: "Opacity easing function"
      },
      progressionMultiplier: {
        label: "Progression multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      layerProgressionMultiplier: {
        label: "Layer progression multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      hueIndexMultiplier: {
        label: "Hue index multiplier",
        component: "slider",
        min: 1,
        max: 16,
        step: 0.1
      },
      hueIndexEasing: {
        component: "easing",
        label: "Hue index easing function"
      },
      hueOffset: {
        label: "Hue offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      }
    }
  },
  grid: {
    component: "nested-object",
    label: "Grid settings",
    fields: {
      proportional: {
        label: "Proportional?",
        component: "checkbox"
      },
      columns: {
        label: "Column",
        component: "slider",
        min: 1,
        max: 30
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 50
      }
    }
  },
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox"
      },
      angleMax: {
        label: "Angle max",
        component: "slider",
        min: 0,
        max: Math.PI,
        step: 0.01
      },
      xMultiplier: {
        label: "X angle multiplier",
        component: "slider",
        min: -9,
        max: 9
      },
      yMultiplier: {
        label: "Y angle multiplier",
        component: "slider",
        min: -9,
        max: 9
      },
      zMultiplier: {
        label: "Z angle multiplier",
        component: "slider",
        min: -9,
        max: 9
      }
    }
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
      },
      xMultiplier: {
        label: "X multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      yMultiplier: {
        label: "Y multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      progressionMultiplier: {
        label: "Progression multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      layerProgressionMultiplier: {
        label: "Layer progression multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      }
    }
  },
  title: titleFormConfiguration,

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
