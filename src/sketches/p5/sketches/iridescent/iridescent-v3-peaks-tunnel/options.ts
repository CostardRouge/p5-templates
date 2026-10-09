import {
  materialFormValues,
  materialFormConfiguration,
  backgroundFormValues,
  backgroundFormConfiguration,
  renderingFormValues,
  renderingFormConfiguration,
  rotationFormConfiguration
} from "../_iridescence.js";

// peaks-tunnel's geometry (tunnel / peaks / noise / rotation), minus the disc
// stack and the per-ring opacity fade, which fog replaces; plus the wall and
// the shared blocks. Fog is on here by default: it is what sends the far end
// of the tunnel into the background.
export const formValues = {
  // Longer, thinner spikes than peaks-tunnel's 109 × 154 px: solid spikes that
  // wide at 60 px spacing fuse into a quilt of bulbs; these stay spikes.
  tunnel: {
    rings: 14,
    segments: 20,
    depthStart: -600,
    depthEnd: -1760,
    depthEasing: "easeInQuad",
    radiusStart: 211,
    radiusEnd: 10,
    radiusEasing: "linear"
  },
  peaks: {
    spikeLengthMax: 190,
    spikeLengthMin: 30,
    depthEasing: "easeInQuad",
    animated: false,
    animSpeed: 1,
    point: {
      strokeWeightMin: 10,
      strokeWeightMax: 60,
      strokeWeightEasing: "easeInSine"
    }
  },
  body: {
    enabled: true,
    scale: 1
  },
  rotation: {
    enabled: true,
    angleMax: 0.08,
    xMultiplier: 1,
    yMultiplier: 1,
    zMultiplier: 1,
    spinTurns: 0
  },
  noise: {
    lengthAmount: 0.5,
    scale: 1.5,
    seed: 42,
    detail: 4,
    falloff: 0.5,
    xMultiplier: 1,
    yMultiplier: 1
  },
  material: {
    ...materialFormValues,
    extra: 0.5,
    fog: {
      amount: 0.85,
      start: 500,
      end: 1500
    }
  },
  background: backgroundFormValues,
  rendering: renderingFormValues
};

export const formConfiguration: Record<string, any> = {
  tunnel: {
    component: "nested-object",
    label: "Tunnel shape",
    fields: {
      rings: {
        label: "Rings (depth)",
        component: "slider",
        min: 1,
        max: 80,
        step: 1
      },
      segments: {
        label: "Segments (around)",
        component: "slider",
        min: 3,
        max: 96,
        step: 1
      },
      depthStart: {
        label: "Depth start (z)",
        component: "slider",
        min: -2000,
        max: 500,
        step: 10
      },
      depthEnd: {
        label: "Depth end (z)",
        component: "slider",
        min: -4000,
        max: 0,
        step: 10
      },
      depthEasing: {
        component: "easing",
        label: "Depth easing (ring spacing)"
      },
      radiusStart: {
        label: "Radius at the mouth",
        component: "slider",
        min: 10,
        max: 800,
        step: 1
      },
      radiusEnd: {
        label: "Radius at the far end",
        component: "slider",
        min: 1,
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
      spikeLengthMax: {
        label: "Spike length at the mouth",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      spikeLengthMin: {
        label: "Spike length at the far end",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      depthEasing: {
        component: "easing",
        label: "Depth easing (length along the tunnel, and each spike's taper)"
      },
      animated: {
        label: "Animate the lengths?",
        component: "checkbox"
      },
      animSpeed: {
        label: "Animation speed",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      point: {
        component: "nested-object",
        label: "Thickness",
        fields: {
          strokeWeightMin: {
            label: "Thickness at the tip",
            component: "slider",
            min: 0.5,
            max: 400,
            step: 0.5
          },
          strokeWeightMax: {
            label: "Thickness at the base",
            component: "slider",
            min: 0.5,
            max: 400,
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
  body: {
    component: "nested-object",
    label: "Wall (the tube the spikes grow from)",
    fields: {
      enabled: {
        label: "Draw the wall?",
        component: "checkbox"
      },
      scale: {
        label: "Wall radius (× the ring radius)",
        component: "slider",
        min: 0.8,
        max: 1.5,
        step: 0.01
      }
    }
  },
  rotation: rotationFormConfiguration,
  noise: {
    component: "nested-object",
    label: "Spike length noise",
    fields: {
      lengthAmount: {
        label: "Amount (0 = every ring's spikes the same length)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      scale: {
        label: "Scale",
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
        label: "Around multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      yMultiplier: {
        label: "Depth multiplier",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      }
    }
  },
  material: materialFormConfiguration( {
    extraLabel: "Depth → colour"
  } ),
  background: backgroundFormConfiguration,
  rendering: renderingFormConfiguration
};
