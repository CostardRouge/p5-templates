import {
  materialFormValues,
  materialFormConfiguration,
  backgroundFormValues,
  backgroundFormConfiguration,
  renderingFormValues,
  renderingFormConfiguration,
  rotationFormConfiguration
} from "../_form.js";

// The peaks family's blocks (peaks, surface, body, rotation, noise) under the
// names v1–v3 use, on a seashell: a spiral that grows by the same factor at
// every turn, its spikes on the outer side and gathered into ridges.
export const formValues = {
  shell: {
    turns: 4,
    growth: 2.5,
    radius: 195,
    height: 620,
    tubeRadius: 170,
    columns: 168,
    rows: 9,
    coverage: 0.55,
    aim: 0.04,
    selfSimilar: 1,
    ridges: 3,
    ridgeAmount: 0.8,
    ridgeSharpness: 2
  },
  peaks: {
    spikeLengthMax: 340,
    spikeLengthMin: 70,
    depthEasing: "easeOutQuad",
    point: {
      strokeWeightMin: 0.5,
      strokeWeightMax: 26,
      strokeWeightEasing: "easeOutQuint"
    }
  },
  surface: {
    noiseScale: 3.2,
    contrast: 2.4,
    contrastEasing: "easeInOutQuad",
    noiseOffset: 150,
    animated: true,
    drift: 0.4
  },
  motion: {
    lean: -12,
    sway: 14,
    swayWaves: 3,
    swaySpeed: 2,
    wave: 0.2,
    waveCount: 5,
    waveSpeed: 3
  },
  body: {
    enabled: true,
    scale: 1
  },
  rotation: {
    enabled: true,
    angleMax: 0.25,
    xMultiplier: 1,
    yMultiplier: 2,
    zMultiplier: 0,
    spinTurns: 1
  },
  noise: {
    seed: 4259,
    detail: 5,
    falloff: 0.43
  },
  material: {
    ...materialFormValues,
    structure: {
      ...materialFormValues.structure,
      weight: 0.3
    },
    // The ramp shifts from the apex to the mouth: the position axis reads
    // 0..1 along the shell and never wraps, so any weight is seamless.
    stagger: {
      ...materialFormValues.stagger,
      weight: 0.7,
      axis: "y",
      cycles: 1
    }
  },
  background: backgroundFormValues,
  rendering: renderingFormValues
};

export const formConfiguration: Record<string, any> = {
  shell: {
    component: "nested-object",
    label: "Shell shape",
    fields: {
      turns: {
        label: "Turns, apex to mouth",
        component: "slider",
        min: 0.5,
        max: 10,
        step: 0.05
      },
      growth: {
        label: "Growth (how much larger the mouth is than the apex, as a logarithm)",
        component: "slider",
        min: 0.2,
        max: 5,
        step: 0.01
      },
      radius: {
        label: "Spiral radius at the mouth",
        component: "slider",
        min: 20,
        max: 500,
        step: 1
      },
      height: {
        label: "Height, apex to mouth (0 = a flat spiral)",
        component: "slider",
        min: 0,
        max: 1000,
        step: 1
      },
      tubeRadius: {
        label: "Tube radius at the mouth",
        component: "slider",
        min: 5,
        max: 300,
        step: 1
      },
      columns: {
        label: "Spikes along the spiral",
        component: "slider",
        min: 3,
        max: 400,
        step: 1
      },
      rows: {
        label: "Spikes across the tube",
        component: "slider",
        min: 1,
        max: 24,
        step: 1
      },
      coverage: {
        label: "Coverage (share of the tube's circumference)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      aim: {
        label: "Aim (where the spikes point, in turns from straight out)",
        component: "slider",
        min: -0.5,
        max: 0.5,
        step: 0.01
      },
      selfSimilar: {
        label: "Self-similar spikes (0 = all one size, 1 = scaled like the shell)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      ridges: {
        label: "Ridges per turn (0 = none)",
        component: "slider",
        min: 0,
        max: 12,
        step: 1
      },
      ridgeAmount: {
        label: "Ridge amount (how short the spikes between ridges)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      ridgeSharpness: {
        label: "Ridge sharpness",
        component: "slider",
        min: 0.2,
        max: 12,
        step: 0.1
      }
    }
  },
  peaks: {
    component: "nested-object",
    label: "Peaks / Spikes",
    fields: {
      spikeLengthMax: {
        label: "Max spike length (at the mouth)",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      spikeLengthMin: {
        label: "Min spike length (at the mouth)",
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
      },
      animated: {
        label: "Animated? (loops)",
        component: "checkbox"
      },
      drift: {
        label: "Animation reach",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion of the spikes",
    fields: {
      lean: {
        label: "Lean (\u00b0 towards the mouth; negative sweeps them back)",
        component: "slider",
        min: -80,
        max: 80,
        step: 1
      },
      sway: {
        label: "Sway (\u00b0 of swing around the lean)",
        component: "slider",
        min: 0,
        max: 60,
        step: 1
      },
      swayWaves: {
        label: "Sway waves, apex to mouth",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.1
      },
      swaySpeed: {
        label: "Sway wavelengths travelled per loop",
        component: "slider",
        min: -8,
        max: 8,
        step: 1
      },
      wave: {
        label: "Length wave amount",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      waveCount: {
        label: "Length waves, apex to mouth",
        component: "slider",
        min: 0,
        max: 24,
        step: 0.1
      },
      waveSpeed: {
        label: "Length wavelengths travelled per loop",
        component: "slider",
        min: -12,
        max: 12,
        step: 1
      }
    }
  },
  body: {
    component: "nested-object",
    label: "Body (the shell under the spikes)",
    fields: {
      enabled: {
        label: "Draw the body?",
        component: "checkbox"
      },
      scale: {
        label: "Body scale (\u00d7 the tube radius)",
        component: "slider",
        min: 0.2,
        max: 1.5,
        step: 0.01
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
      }
    }
  },
  rotation: rotationFormConfiguration,
  material: materialFormConfiguration( {
    structureLabel: "Terrain height → colour"
  } ),
  background: backgroundFormConfiguration,
  rendering: renderingFormConfiguration
};
