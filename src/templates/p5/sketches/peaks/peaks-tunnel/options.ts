
export const formValues = {
  tunnel: {
    rings: 12,
    segments: 22,
    depthStart: -600,
    depthEnd: -1760,
    depthEasing: "easeInQuad",
    radiusStart: 211,
    radiusEnd: 10,
    radiusEasing: "linear"
  },
  peaks: {
    layers: 35,
    spikeLengthMax: 109,
    spikeLengthMin: 0,
    depthEasing: "easeInQuad",
    animated: true,
    animSpeed: 1.03,
    point: {
      strokeWeightMin: 12,
      strokeWeightMax: 154,
      strokeWeightEasing: "easeOutSine"
    }
  },
  depthOpacity: {
    start: 1,
    end: 0.5,
    easing: "linear"
  },
  lod: {
    enabled: true,
    minLayers: 29
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ],
  rotation: {
    enabled: false,
    angleMax: 0.03,
    xMultiplier: -2.2,
    yMultiplier: -0.6,
    zMultiplier: 6.2
  },
  colors: {
    opacityMax: 4.1,
    opacityMin: 1.4,
    opacityEasing: "easeInQuad",
    progressionMultiplier: 1,
    layerProgressionMultiplier: 1,
    hueIndexMultiplier: 2.7,
    hueDepthMixing: 0,
    hueIndexEasing: "easeOutSine",
    hueOffset: -0.061592653589793
  },
  noise: {
    scale: 1.5,
    seed: 42,
    detail: 4,
    falloff: 0.5,
    xMultiplier: 1,
    yMultiplier: 1,
    layerProgressionMultiplier: 0.4,
    animMultiplier: 0.3
  }
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  tunnel: {
    component: "nested-object",
    label: "Tunnel shape",
    fields: {
      rings: {
        label: "Rings (depth slices)",
        component: "slider",
        min: 2,
        max: 120,
        step: 1
      },
      segments: {
        label: "Segments per ring",
        component: "slider",
        min: 3,
        max: 120,
        step: 1
      },
      depthStart: {
        label: "Depth start (Z)",
        component: "slider",
        min: -2000,
        max: 500,
        step: 10
      },
      depthEnd: {
        label: "Depth end (Z)",
        component: "slider",
        min: -2000,
        max: 500,
        step: 10
      },
      depthEasing: {
        component: "easing",
        label: "Depth easing"
      },
      radiusStart: {
        label: "Radius start (near)",
        component: "slider",
        min: 10,
        max: 800,
        step: 1
      },
      radiusEnd: {
        label: "Radius end (far)",
        component: "slider",
        min: 10,
        max: 800,
        step: 1
      },
      radiusEasing: {
        component: "easing",
        label: "Radius easing"
      }
    }
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
        step: 1
      },
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
        label: "Spike depth easing"
      },
      animated: {
        label: "Animated peaks?",
        component: "checkbox"
      },
      animSpeed: {
        label: "Animation speed",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
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
            step: 0.5
          },
          strokeWeightMax: {
            label: "Stroke weight (base)",
            component: "slider",
            min: 0.5,
            max: 500,
            step: 0.5
          },
          strokeWeightEasing: {
            component: "easing",
            label: "Stroke weight easing"
          }
        }
      }
    }
  },
  depthOpacity: {
    component: "nested-object",
    label: "Depth opacity",
    fields: {
      start: {
        label: "Opacity start (near)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      end: {
        label: "Opacity end (far)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      easing: {
        component: "easing",
        label: "Depth opacity easing"
      }
    }
  },
  lod: {
    component: "nested-object",
    label: "Level of Detail (LOD)",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox"
      },
      minLayers: {
        label: "Min layers (shortest spikes)",
        component: "slider",
        min: 1,
        max: 30,
        step: 1
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
      hueDepthMixing: {
        label: "Hue–depth mixing",
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
        label: "X wobble speed",
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1
      },
      yMultiplier: {
        label: "Y wobble speed",
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1
      },
      zMultiplier: {
        label: "Z wobble speed",
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
      scale: {
        label: "Noise scale",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      },
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

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
