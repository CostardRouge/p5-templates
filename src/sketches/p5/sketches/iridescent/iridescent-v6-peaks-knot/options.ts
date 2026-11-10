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
// names v1–v3 use, on a torus knot; plus what only a closed curve can do —
// the spikes travelling along it, the rows rolling around it.
export const formValues = {
  knot: {
    p: 2,
    q: 3,
    majorRadius: 280,
    minorRadius: 130,
    tubeRadius: 22,
    columns: 160,
    rows: 8,
    twist: 2,
    stagger: true
  },
  peaks: {
    spikeLengthMax: 240,
    spikeLengthMin: 34,
    depthEasing: "easeOutQuad",
    point: {
      strokeWeightMin: 0.5,
      strokeWeightMax: 24,
      strokeWeightEasing: "easeOutQuint"
    }
  },
  surface: {
    noiseScale: 3.2,
    contrast: 2.4,
    contrastEasing: "easeInOutQuad",
    noiseOffset: 150,
    animated: true,
    drift: 0.5
  },
  motion: {
    flowTrips: 1,
    rollTurns: 1,
    wave: 0.25,
    waveCount: 6,
    waveSpeed: 3
  },
  body: {
    enabled: true,
    scale: 0.7
  },
  rotation: {
    enabled: true,
    angleMax: 0.4,
    xMultiplier: 1,
    yMultiplier: 1,
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
    // One turn of the ramp around the knot's axis: the hue runs along the
    // curve, on the needles and the tube alike. A whole cycle at weight 1,
    // so the ramp meets itself where the angle wraps.
    stagger: {
      ...materialFormValues.stagger,
      weight: 1,
      axis: "angle",
      cycles: 1
    }
  },
  background: backgroundFormValues,
  rendering: renderingFormValues
};

export const formConfiguration: Record<string, any> = {
  knot: {
    component: "nested-object",
    label: "Knot shape",
    fields: {
      p: {
        label: "Turns around the axis (p)",
        component: "slider",
        min: 1,
        max: 7,
        step: 1
      },
      q: {
        label: "Turns through the hole (q; 0 = a plain ring)",
        component: "slider",
        min: 0,
        max: 9,
        step: 1
      },
      majorRadius: {
        label: "Ring radius",
        component: "slider",
        min: 50,
        max: 500,
        step: 1
      },
      minorRadius: {
        label: "Winding radius (how far the curve leaves the ring)",
        component: "slider",
        min: 0,
        max: 300,
        step: 1
      },
      tubeRadius: {
        label: "Tube radius (where the spikes stand)",
        component: "slider",
        min: 2,
        max: 150,
        step: 1
      },
      columns: {
        label: "Spikes along the curve",
        component: "slider",
        min: 3,
        max: 400,
        step: 1
      },
      rows: {
        label: "Spikes around the tube",
        component: "slider",
        min: 1,
        max: 24,
        step: 1
      },
      twist: {
        label: "Twist (turns of the rows per trip along the curve)",
        component: "slider",
        min: -12,
        max: 12,
        step: 1
      },
      stagger: {
        label: "Stagger every other column?",
        component: "checkbox"
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
    label: "Motion along the knot",
    fields: {
      flowTrips: {
        label: "Whole trips of the spikes along the curve, per loop",
        component: "slider",
        min: -3,
        max: 3,
        step: 1
      },
      rollTurns: {
        label: "Whole turns of the rows around the tube, per loop",
        component: "slider",
        min: -6,
        max: 6,
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
        label: "Waves along the curve",
        component: "slider",
        min: 0,
        max: 24,
        step: 1
      },
      waveSpeed: {
        label: "Wavelengths travelled per loop",
        component: "slider",
        min: -12,
        max: 12,
        step: 1
      }
    }
  },
  body: {
    component: "nested-object",
    label: "Body (the tube under the spikes)",
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
