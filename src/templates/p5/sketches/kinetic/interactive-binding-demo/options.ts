// ── Interactive binding demo — options ──────────────────────────────────────
// `formValues` holds the BASE values (what the form edits, what "save defaults"
// captures). `bindings` is the modulation matrix: each entry drives one
// parameter from one interaction channel at read time. Bindings are deliberately
// NOT part of `formConfiguration` — they are data the (future) binding UI
// manages, they persist with the options JSON, and "randomize" leaves them
// untouched because it only walks configured fields.

export const formValues = {
  backgroundColor: [
    12,
    12,
    16
  ],
  dotColor: [
    235,
    240,
    255
  ],
  radius: 160,
  strokeWeight: 6,
  count: 8,
  spin: 0,
  position: {
    x: 0.5,
    y: 0.5
  },

  // ── Interactive bindings (the MVP modulation matrix) ──────────────────────
  bindings: [
    {
      // vector2d passthrough: the ring center follows the cursor.
      source: "mouse",
      target: "position",
      kind: "vector2d",
      mapping: {
        x: {
          min: 0,
          max: 1
        },
        y: {
          min: 0,
          max: 1
        }
      },
      smoothing: 0.15,
      enabled: true
    },
    {
      // mouse.y → thickness (inverted: thicker toward the bottom).
      source: "mouse",
      project: "y",
      target: "strokeWeight",
      kind: "continuous",
      mapping: {
        min: 1,
        max: 26
      },
      smoothing: 0.25,
      enabled: true
    },
    {
      // mouse.x → number of dots.
      source: "mouse",
      project: "x",
      target: "count",
      kind: "continuous",
      mapping: {
        min: 3,
        max: 18
      },
      smoothing: 0.2,
      enabled: true
    },
    {
      // Sine oscillator → radius (pulses 0→max→0 once per loop).
      source: "oscillator",
      target: "radius",
      kind: "continuous",
      oscillator: {
        wave: "sine",
        cycles: 1,
        phase: 0
      },
      mapping: {
        min: 80,
        max: 260
      },
      enabled: true
    },
    {
      // Sawtooth oscillator → rotation (continuous spin, one turn per loop).
      source: "oscillator",
      target: "spin",
      kind: "continuous",
      oscillator: {
        wave: "sawtooth",
        cycles: 1,
        phase: 0
      },
      mapping: {
        min: 0,
        max: 6.2832
      },
      enabled: true
    }
  ]
};

export const formConfiguration: Record<string, any> = {
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  dotColor: {
    component: "color",
    label: "Dot color"
  },
  radius: {
    component: "slider",
    label: "Radius",
    min: 10,
    max: 400,
    step: 1
  },
  strokeWeight: {
    component: "slider",
    label: "Stroke weight",
    min: 0,
    max: 40,
    step: 0.5
  },
  count: {
    component: "slider",
    label: "Count",
    min: 1,
    max: 24,
    step: 1
  },
  spin: {
    component: "slider",
    label: "Spin",
    min: 0,
    max: 6.2832,
    step: 0.01
  },
  position: {
    component: "vector2d",
    label: "Position",
    allowNegative: false,
    min: 0,
    max: 1,
    step: 0.01,
    yDown: true
  }
};
