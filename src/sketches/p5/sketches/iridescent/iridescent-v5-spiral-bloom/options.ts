import {
  materialFormValues,
  materialFormConfiguration,
  backgroundFormValues,
  backgroundFormConfiguration,
  renderingFormValues,
  renderingFormConfiguration,
  rotationFormConfiguration
} from "../_form.js";

// A phyllotaxis flower: the spiral that places the petals, the receptacle they
// grow from, the petal itself (a flattened, cupped, curled blade), then what
// moves — the bloom, a ripple of length — plus the blocks every iridescent
// sketch shares. Angles are in degrees here and converted in index.js.
export const formValues = {
  spiral: {
    count: 233,
    divergence: 137.5,
    breath: 0.12,
    breathCycles: 1,
    swirl: 0,
    turns: 0
  },
  receptacle: {
    radius: 150,
    spread: 96,
    packing: 0.62,
    elongation: 0.8,
    body: true,
    bodyScale: 0.94
  },
  petals: {
    lengthInner: 90,
    lengthOuter: 360,
    growEasing: "easeInQuad",
    width: 92,
    widthInner: 0.32,
    tip: 1,
    widthEasing: "easeOutQuart",
    taperEasing: "linear",
    thickness: 0.14,
    pinch: 0.7,
    cup: 0.35,
    leanInner: 6,
    leanOuter: 94,
    leanEasing: "easeOutSine",
    curlInner: 0.9,
    curlOuter: -0.9
  },
  bloom: {
    amount: 0.55,
    cycles: 1,
    lag: 0.6,
    curl: 1.1
  },
  ripple: {
    amount: 0.12,
    waves: 3,
    speed: 2
  },
  noise: {
    variation: 0.25,
    scale: 0.9,
    animated: false,
    drift: 0.6,
    seed: 4259,
    detail: 4,
    falloff: 0.5
  },
  rotation: {
    enabled: true,
    angleMax: 0.3,
    xMultiplier: 1,
    yMultiplier: 1,
    zMultiplier: 0,
    spinTurns: 0,
    tilt: -18
  },
  // The category's material, with the ramp staggered along the petal index:
  // successive petals sit a golden angle apart, so a ramp read by the index
  // paints the spiral arms themselves.
  material: {
    ...materialFormValues,
    ramp: {
      ...materialFormValues.ramp,
      bands: 0.6
    },
    structure: {
      ...materialFormValues.structure,
      weight: 0.15
    },
    stagger: {
      ...materialFormValues.stagger,
      weight: 1,
      axis: "index",
      cycles: 2
    }
  },
  background: backgroundFormValues,
  rendering: renderingFormValues
};

export const formConfiguration: Record<string, any> = {
  spiral: {
    component: "nested-object",
    label: "Spiral (phyllotaxis)",
    fields: {
      count: {
        label: "Petals",
        component: "slider",
        min: 8,
        max: 600,
        step: 1
      },
      divergence: {
        label: "Divergence angle (° between two petals; 137.5 is the golden angle)",
        component: "slider",
        min: 90,
        max: 180,
        step: 0.01
      },
      breath: {
        label: "Breathing of the angle (°, winds and unwinds the arms)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      breathCycles: {
        label: "Breaths per loop",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      swirl: {
        label: "Swirl (° of extra turn from heart to rim)",
        component: "slider",
        min: -360,
        max: 360,
        step: 1
      },
      turns: {
        label: "Whole turns per loop (around the flower's axis)",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      }
    }
  },
  receptacle: {
    component: "nested-object",
    label: "Receptacle (what the petals grow from)",
    fields: {
      radius: {
        label: "Radius",
        component: "slider",
        min: 10,
        max: 400,
        step: 1
      },
      spread: {
        label: "Spread (° — 90 covers a dome, 180 a whole ball)",
        component: "slider",
        min: 10,
        max: 180,
        step: 1
      },
      packing: {
        label: "Packing (0.5 = even, lower crowds the rim)",
        component: "slider",
        min: 0.2,
        max: 1.5,
        step: 0.01
      },
      elongation: {
        label: "Elongation (1 = round, more = a cone)",
        component: "slider",
        min: 0.2,
        max: 3,
        step: 0.01
      },
      body: {
        label: "Draw the body?",
        component: "checkbox"
      },
      bodyScale: {
        label: "Body scale",
        component: "slider",
        min: 0.3,
        max: 1.5,
        step: 0.01
      }
    }
  },
  petals: {
    component: "nested-object",
    label: "Petals",
    fields: {
      lengthInner: {
        label: "Length at the heart",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      lengthOuter: {
        label: "Length at the rim",
        component: "slider",
        min: 0,
        max: 800,
        step: 1
      },
      growEasing: {
        component: "easing",
        label: "Growth easing (heart → rim)"
      },
      width: {
        label: "Width at the rim",
        component: "slider",
        min: 0.5,
        max: 300,
        step: 0.5
      },
      widthInner: {
        label: "Width at the heart (× the rim's)",
        component: "slider",
        min: 0.05,
        max: 1.5,
        step: 0.01
      },
      tip: {
        label: "Width at the tip",
        component: "slider",
        min: 0.5,
        max: 100,
        step: 0.5
      },
      widthEasing: {
        component: "easing",
        label: "Width easing (tip → base)"
      },
      taperEasing: {
        component: "easing",
        label: "Taper easing (where along its length a petal narrows)"
      },
      thickness: {
        label: "Thickness (× the width; 1 = a round spike)",
        component: "slider",
        min: 0.02,
        max: 1,
        step: 0.01
      },
      pinch: {
        label: "Pinched foot",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      cup: {
        label: "Cupped section (edges lifted towards the heart)",
        component: "slider",
        min: -1,
        max: 1,
        step: 0.01
      },
      leanInner: {
        label: "Lean at the heart (° from the axis)",
        component: "slider",
        min: 0,
        max: 90,
        step: 1
      },
      leanOuter: {
        label: "Lean at the rim (° from the axis; past 90 lays back)",
        component: "slider",
        min: 0,
        max: 170,
        step: 1
      },
      leanEasing: {
        component: "easing",
        label: "Lean easing (heart → rim)"
      },
      curlInner: {
        label: "Curl at the heart (+ cups in, − lays back)",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      },
      curlOuter: {
        label: "Curl at the rim",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      }
    }
  },
  bloom: {
    component: "nested-object",
    label: "Bloom (closing and reopening)",
    fields: {
      amount: {
        label: "Amount (0 = stays open, 1 = folds onto the axis)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      cycles: {
        label: "Blooms per loop",
        component: "slider",
        min: 0,
        max: 4,
        step: 1
      },
      lag: {
        label: "Wave lag, heart → rim (cycles)",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      curl: {
        label: "Extra curl while closed",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      }
    }
  },
  ripple: {
    component: "nested-object",
    label: "Length ripple (travels along the spiral)",
    fields: {
      amount: {
        label: "Amount",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      waves: {
        label: "Waves, heart → rim",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.1
      },
      speed: {
        label: "Wavelengths travelled per loop",
        component: "slider",
        min: -6,
        max: 6,
        step: 1
      }
    }
  },
  noise: {
    component: "nested-object",
    label: "Length variation (noise)",
    fields: {
      variation: {
        label: "Variation",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      scale: {
        label: "Scale (per petal)",
        component: "slider",
        min: 0.01,
        max: 3,
        step: 0.01
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
  rotation: {
    ...rotationFormConfiguration,
    fields: {
      tilt: {
        label: "Tilt (° — 0 looks straight into the flower)",
        component: "slider",
        min: -90,
        max: 90,
        step: 1
      },
      ...rotationFormConfiguration.fields
    }
  },
  material: materialFormConfiguration( {
    structureLabel: "Petal length → colour"
  } ),
  background: backgroundFormConfiguration,
  rendering: renderingFormConfiguration
};
