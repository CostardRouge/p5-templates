import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  sphere: {
    radiusX: 221,
    radiusY: 151,
    radiusZ: 600,
    meridians: 24,
    parallels: 12
  },
  cone: {
    nTheta: 11,
    layers: 167,
    profileType: 0,
    taper: 0.24,
    twist: 0.2
  },
  peaks: {
    spikeLengthMax: 342,
    spikeLengthMin: 300,
    point: {
      strokeWeightMin: 0.5,
      strokeWeightMax: 3.5
    }
  },
  surface: {
    noiseScale: 4.2,
    noiseSpeed: 0.85,
    animated: true,
    contrast: 4.56,
    contrastEasing: "easeInQuad",
    noiseOffset: 0
  },
  rotation: {
    enabled: true,
    angleMax: 0.2,
    xMultiplier: 1,
    yMultiplier: 2,
    zMultiplier: 0
  },
  colors: {
    opacityMax: 1.6,
    opacityMin: 1,
    opacityEasing: "easeOutQuad",
    progressionMultiplier: 8.6,
    layerProgressionMultiplier: 0.7,
    hueIndexMultiplier: 5,
    hueSurfaceMixing: 0.3,
    hueIndexEasing: "easeOutSine",
    hueOffset: 0
  },
  noise: {
    seed: 42,
    detail: 4,
    falloff: 0.5,
    xMultiplier: 1,
    yMultiplier: 1,
    layerProgressionMultiplier: 0.4,
    animMultiplier: 0.3
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  sphere: {
    component: "nested-object",
    label: "Sphere surface",
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
        min: 3,
        max: 120,
        step: 1
      },
      parallels: {
        label: "Parallels (latitude)",
        component: "slider",
        min: 2,
        max: 60,
        step: 1
      }
    }
  },
  cone: {
    component: "nested-object",
    label: "Cone / spike shape (GPU)",
    fields: {
      nTheta: {
        label: "Segments around cone",
        component: "slider",
        min: 1,
        max: 320,
        step: 1
      },
      layers: {
        label: "Layers along spike",
        component: "slider",
        min: 2,
        max: 300,
        step: 1
      },
      profileType: {
        label: "Profile type (0=cone · 1=droplet · 2=tube · 3=bulge)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      taper: {
        label: "Taper (cone radius / spike length)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.005
      },
      twist: {
        label: "Twist (rad/unit height)",
        component: "slider",
        min: -0.2,
        max: 0.2,
        step: 0.001
      }
    }
  },
  peaks: {
    component: "nested-object",
    label: "Peaks",
    fields: {
      spikeLengthMax: {
        label: "Max spike length",
        component: "slider",
        min: 0,
        max: 1800,
        step: 1
      },
      spikeLengthMin: {
        label: "Min spike length",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      point: {
        component: "nested-object",
        label: "Point size",
        fields: {
          strokeWeightMin: {
            label: "Point size (tip)",
            component: "slider",
            min: 0.5,
            max: 100,
            step: 0.5
          },
          strokeWeightMax: {
            label: "Point size (base)",
            component: "slider",
            min: 0.5,
            max: 100,
            step: 0.5
          }
        }
      }
    }
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
        label: "Contrast",
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
        label: "Noise offset",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.1
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
        min: 0,
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
        label: "Opacity easing"
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
      hueSurfaceMixing: {
        label: "Hue–surface mixing",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      hueIndexEasing: {
        component: "easing",
        label: "Hue index easing"
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
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      enabled: {
        label: "Animated wobble?",
        component: "checkbox"
      },
      angleMax: {
        label: "Wobble amplitude",
        component: "slider",
        min: 0,
        max: Math.PI,
        step: 0.01
      },
      xMultiplier: {
        label: "X wobble speed (snaps to whole turns/loop)",
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1
      },
      yMultiplier: {
        label: "Y wobble speed (snaps to whole turns/loop)",
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1
      },
      zMultiplier: {
        label: "Z wobble speed (snaps to whole turns/loop)",
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1
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
      layerProgressionMultiplier: {
        label: "Layer progression multiplier",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      animMultiplier: {
        label: "Color animation multiplier",
        component: "slider",
        min: 0,
        max: 5,
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
