// ─────────────────────────────────────────────────────────────────────────────
// The iridescent category's form blocks — the data every `options.ts` here
// spreads: the material, the gradient background, the rendering and the
// rotation.
//
// This module imports NOTHING. `options.ts` files are loaded server-side,
// outside the browser, by `@/engines/sketchOptionLoaders`; an import chain
// that reaches the p5 runtime (`animation.js` → `sketch.js`) fails there, the
// loader's catch turns the failure into an empty form, and the sketch shows
// up in the studio with no controls at all. The runtime half of the material
// (GLSL, the ramp bake, the uniforms) lives in `_iridescence.js`, which the
// sketches' `index.js` import and the forms never do.
//
// ── How the material reads ───────────────────────────────────────────────────
// One ramp coordinate per pixel, in ramp cycles:
//
//   x = combine( facing, light, structure ) × bands      ← the SHAPE terms
//     + stagger + wave                                  ← the OFFSET terms
//     + offset + drift                                   ← the global phase
//
// A shape term is a 0..1 value read off the surface (the viewing angle, the
// lit side, what the sketch feeds — terrain height, ring depth, pipe index),
// each through its own formula and easing curve. An offset term shifts the
// ramp by whole cycles along a coordinate of the structure (the spike's index,
// column, row, its position along an axis…), static for the stagger and
// travelling for the wave. `fold` decides what happens past the ramp's end:
// wrap back to the first stop, or mirror back down the ramp.
// ─────────────────────────────────────────────────────────────────────────────

// The reference's palette, in ramp order: blue → green → cream → pink → wine →
// navy, then back to blue. Read off the video frame by frame (centre → rim).
export const materialFormValues = {
  ramp: {
    stops: [
      [
        52,
        72,
        228
      ],
      [
        72,
        150,
        30
      ],
      [
        242,
        232,
        196
      ],
      [
        242,
        84,
        136
      ],
      [
        128,
        6,
        46
      ],
      [
        16,
        18,
        56
      ]
    ],
    hardness: 0.35,
    bands: 0.75,
    fold: "wrap",
    offset: 0,
    cyclesPerLoop: 1,
    driftCurve: "linear"
  },
  combine: "add",
  facing: {
    weight: 1,
    formula: "angle",
    power: 2,
    curve: "linear"
  },
  light: {
    weight: 0.6,
    direction: {
      x: 0.5,
      y: 0.6,
      z: -0.6
    },
    wrap: 0,
    curve: "linear"
  },
  structure: {
    weight: 0.3,
    curve: "linear"
  },
  stagger: {
    weight: 0,
    axis: "index",
    cycles: 1,
    curve: "linear"
  },
  wave: {
    weight: 0,
    axis: "y",
    cycles: 1,
    speed: 1,
    shape: "sine",
    curve: "linear"
  },
  shading: 0.12,
  fog: {
    amount: 0,
    start: 400,
    end: 1600
  }
};

export const backgroundFormValues = {
  top: [
    178,
    188,
    206
  ],
  bottom: [
    202,
    210,
    226
  ]
};

export const renderingFormValues = {
  supersample: "2",
  detail: 1
};

// The coordinates an offset term (stagger, wave) can run along. The position
// axes are in the sketch's own units, normalised by the scene size it
// declares; "angle" and "radial" are taken around the sketch's main axis.
export const AXIS_OPTIONS = [
  {
    value: "index",
    label: "Spike index (the order they are laid out in)"
  },
  {
    value: "column",
    label: "Column (around)"
  },
  {
    value: "row",
    label: "Row (along)"
  },
  {
    value: "x",
    label: "Position x"
  },
  {
    value: "y",
    label: "Position y"
  },
  {
    value: "z",
    label: "Position z"
  },
  {
    value: "radial",
    label: "Distance from the main axis"
  },
  {
    value: "distance",
    label: "Distance from the centre"
  },
  {
    value: "angle",
    label: "Angle around the main axis"
  }
];

/**
 * The `material` form block. `structureLabel` names what the sketch feeds the
 * structure term with (terrain, height, depth…), since the slider means
 * nothing without it; `fogRange` sizes the fog sliders to the sketch's units.
 */
export function materialFormConfiguration( {
  structureLabel = "Structure → colour",
  fogRange = {
    max: 4000,
    step: 10
  }
} = {} ) {
  return {
    component: "nested-object",
    label: "Iridescent material",
    fields: {
      ramp: {
        component: "nested-object",
        label: "Colour ramp",
        fields: {
          stops: {
            label: "Stops, in order (the ramp loops back to the first)",
            component: "item-list",
            minItems: 2,
            maxItems: 12,
            itemConfig: {
              label: "Stop",
              component: "color"
            }
          },
          hardness: {
            label: "Band hardness (0 = soft blend, 1 = flat bands)",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          },
          bands: {
            label: "Ramp cycles across the shape terms (0 → 1)",
            component: "slider",
            min: 0.1,
            max: 4,
            step: 0.05
          },
          fold: {
            label: "Past the last stop…",
            component: "select",
            options: [
              {
                value: "wrap",
                label: "Wrap back to the first stop"
              },
              {
                value: "mirror",
                label: "Mirror back down the ramp"
              }
            ]
          },
          offset: {
            label: "Ramp offset (which stop faces the camera)",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          },
          cyclesPerLoop: {
            label: "Colour drift: whole cycles per loop",
            component: "slider",
            min: -4,
            max: 4,
            step: 1
          },
          driftCurve: {
            component: "easing",
            label: "Drift curve (how the drift moves through the loop)"
          }
        }
      },
      combine: {
        label: "How the shape terms combine",
        component: "select",
        options: [
          {
            value: "add",
            label: "Add (weights sum)"
          },
          {
            value: "multiply",
            label: "Multiply (each term fades the others)"
          }
        ]
      },
      facing: {
        component: "nested-object",
        label: "Facing term (the viewing angle)",
        fields: {
          weight: {
            label: "Weight",
            component: "slider",
            min: 0,
            max: 2,
            step: 0.01
          },
          formula: {
            label: "Formula",
            component: "select",
            options: [
              {
                value: "angle",
                label: "Angle to the lens, 0° → 90° (even spread)"
              },
              {
                value: "cosine",
                label: "1 − cos (bands gather at the rim)"
              },
              {
                value: "fresnel",
                label: "Fresnel: (1 − cos) ^ power (thin rim)"
              },
              {
                value: "inverse",
                label: "Inverted angle (rim first, centre last)"
              }
            ]
          },
          power: {
            label: "Fresnel power",
            component: "slider",
            min: 0.25,
            max: 8,
            step: 0.05
          },
          curve: {
            component: "easing",
            label: "Curve"
          }
        }
      },
      light: {
        component: "nested-object",
        label: "Directional term (the lit side)",
        fields: {
          weight: {
            label: "Weight",
            component: "slider",
            min: 0,
            max: 2,
            step: 0.01
          },
          direction: {
            component: "vector3d",
            label: "Light direction (camera space, the way it travels)",
            kind: "direction",
            min: -1,
            max: 1,
            step: 0.01,
            yDown: true
          },
          wrap: {
            label: "Wrap (0 = hard terminator, 1 = reaches the far side)",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          },
          curve: {
            component: "easing",
            label: "Curve"
          }
        }
      },
      structure: {
        component: "nested-object",
        label: structureLabel,
        fields: {
          weight: {
            label: "Weight",
            component: "slider",
            min: 0,
            max: 2,
            step: 0.01
          },
          curve: {
            component: "easing",
            label: "Curve"
          }
        }
      },
      stagger: {
        component: "nested-object",
        label: "Stagger (a fixed ramp offset per spike)",
        fields: {
          weight: {
            label: "Amount (ramp cycles across the whole structure)",
            component: "slider",
            min: -2,
            max: 2,
            step: 0.01
          },
          axis: {
            label: "Along",
            component: "select",
            options: AXIS_OPTIONS
          },
          cycles: {
            label: "Repeats across the structure",
            component: "slider",
            min: 0.1,
            max: 8,
            step: 0.1
          },
          curve: {
            component: "easing",
            label: "Curve"
          }
        }
      },
      wave: {
        component: "nested-object",
        label: "Wave (a ramp offset travelling through the structure)",
        fields: {
          weight: {
            label: "Amount (ramp cycles)",
            component: "slider",
            min: -2,
            max: 2,
            step: 0.01
          },
          axis: {
            label: "Along",
            component: "select",
            options: AXIS_OPTIONS
          },
          cycles: {
            label: "Wavelengths across the structure",
            component: "slider",
            min: 0.1,
            max: 8,
            step: 0.1
          },
          speed: {
            label: "Speed: whole wavelengths per loop (negative = backwards)",
            component: "slider",
            min: -6,
            max: 6,
            step: 1
          },
          shape: {
            label: "Shape",
            component: "select",
            options: [
              {
                value: "sine",
                label: "Sine (smooth)"
              },
              {
                value: "triangle",
                label: "Triangle (linear up and down)"
              },
              {
                value: "saw",
                label: "Saw (ramps up, snaps back)"
              }
            ]
          },
          curve: {
            component: "easing",
            label: "Curve"
          }
        }
      },
      shading: {
        label: "Shading (darken the far side)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      fog: {
        component: "nested-object",
        label: "Fog (fades to the background colour)",
        fields: {
          amount: {
            label: "Amount",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          },
          start: {
            label: "Starts at (distance from the eye)",
            component: "slider",
            min: 0,
            max: fogRange.max,
            step: fogRange.step
          },
          end: {
            label: "Full at (distance from the eye)",
            component: "slider",
            min: 0,
            max: fogRange.max,
            step: fogRange.step
          }
        }
      }
    }
  };
}

export const backgroundFormConfiguration = {
  component: "nested-object",
  label: "Background",
  fields: {
    top: {
      component: "color",
      label: "Top"
    },
    bottom: {
      component: "color",
      label: "Bottom"
    }
  }
};

export const renderingFormConfiguration = {
  component: "nested-object",
  label: "Rendering",
  fields: {
    supersample: {
      label: "Antialiasing (supersampling)",
      component: "select",
      options: [
        {
          value: "1",
          label: "Off (1×)"
        },
        {
          value: "2",
          label: "2× (default)"
        },
        {
          value: "3",
          label: "3× (exports)"
        }
      ]
    },
    detail: {
      label: "Mesh detail (quality ↔ speed)",
      component: "slider",
      min: 0.25,
      max: 2,
      step: 0.05
    }
  }
};

export const rotationFormConfiguration = {
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
      step: 1
    },
    yMultiplier: {
      label: "Y wobble speed",
      component: "slider",
      min: -9,
      max: 9,
      step: 1
    },
    zMultiplier: {
      label: "Z wobble speed",
      component: "slider",
      min: -9,
      max: 9,
      step: 1
    },
    spinTurns: {
      label: "Whole turns per loop (around y)",
      component: "slider",
      min: -4,
      max: 4,
      step: 1
    }
  }
};
