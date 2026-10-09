import {
  materialFormValues,
  materialFormConfiguration,
  backgroundFormValues,
  backgroundFormConfiguration,
  renderingFormValues,
  renderingFormConfiguration,
  rotationFormConfiguration
} from "../_iridescence.js";

// peaks-cylinder's geometry (cylinder / peaks / rotation), minus the disc
// stack; plus a length-noise field, the pill body and the shared blocks.
export const formValues = {
  // Fewer, thinner arms on a fatter pill than peaks-cylinder's 14 × 194 px:
  // solid arms that wide at 36 px spacing intersect along their whole length
  // and the intersections read as a jagged crown, where the original's flat
  // discs simply overlapped.
  cylinder: {
    radius: 90,
    height: 684,
    spikeLength: 288,
    columns: 9,
    rows: 6
  },
  peaks: {
    depthEasing: "easeOutQuad",
    point: {
      strokeWeightMax: 120,
      strokeWeightMin: 41,
      strokeWeightEasing: "easeInSine"
    }
  },
  body: {
    enabled: true,
    scale: 1.5,
    capRound: 1
  },
  rotation: {
    enabled: true,
    angleMax: 0.3,
    xMultiplier: 1,
    yMultiplier: 2,
    zMultiplier: 0,
    spinTurns: 1
  },
  noise: {
    lengthAmount: 0.35,
    scale: 2.2,
    animated: false,
    speed: 1,
    seed: 620,
    detail: 4,
    falloff: 0.5
  },
  material: {
    ...materialFormValues,
    extra: 0.2
  },
  background: backgroundFormValues,
  rendering: renderingFormValues
};

export const formConfiguration: Record<string, any> = {
  cylinder: {
    component: "nested-object",
    label: "Cylinder",
    fields: {
      radius: {
        label: "Radius",
        component: "slider",
        min: 10,
        max: 800,
        step: 1
      },
      height: {
        label: "Height",
        component: "slider",
        min: 10,
        max: 1200,
        step: 1
      },
      spikeLength: {
        label: "Spike length",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      columns: {
        label: "Columns (around)",
        component: "slider",
        min: 2,
        max: 120,
        step: 1
      },
      rows: {
        label: "Rows (height)",
        component: "slider",
        min: 1,
        max: 60,
        step: 1
      }
    }
  },
  peaks: {
    component: "nested-object",
    label: "Peaks",
    fields: {
      depthEasing: {
        component: "easing",
        label: "Depth easing (the spike's taper along its length)"
      },
      point: {
        component: "nested-object",
        label: "Thickness",
        fields: {
          strokeWeightMax: {
            label: "Thickness at the base",
            component: "slider",
            min: 1,
            max: 350,
            step: 1
          },
          strokeWeightMin: {
            label: "Thickness at the tip",
            component: "slider",
            min: 1,
            max: 350,
            step: 1
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
    label: "Body (the pill under the spikes)",
    fields: {
      enabled: {
        label: "Draw the body?",
        component: "checkbox"
      },
      scale: {
        label: "Body radius (× the cylinder radius)",
        component: "slider",
        min: 0.5,
        max: 2,
        step: 0.01
      },
      capRound: {
        label: "End rounding (0 = flat, 1 = hemisphere)",
        component: "slider",
        min: 0,
        max: 1,
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
        label: "Amount (0 = every spike the same length)",
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
      animated: {
        label: "Animated?",
        component: "checkbox"
      },
      speed: {
        label: "Animation speed",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
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
      }
    }
  },
  material: materialFormConfiguration( {
    extraLabel: "Height → colour"
  } ),
  background: backgroundFormConfiguration,
  rendering: renderingFormConfiguration
};
