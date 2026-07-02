// Shared form fragments for the "metaballs" category so every variant exposes
// the same ball-simulation, grid and palette controls without duplication.

import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

export {
  interactionFormConfiguration
};

// Interaction defaults tuned for these sketches: every source starts OFF (so the
// procedural look is preserved until the user opts in) and the debug overlay is
// muted. Flip on Mouse / Vision / Audio / Orbit / Gyroscope to push the field.
export const interactionDefaults = {
  ...interactionFormValues,
  orbit: {
    ...interactionFormValues.orbit,
    enabled: false
  },
  visualization: {
    ...interactionFormValues.visualization,
    enabled: false
  }
};

export const interactionMixValues = {
  mode: "add",
  pointerRadius: 130
};

export const interactionMixConfig = {
  label: "Interaction → metaballs",
  component: "nested-object",
  fields: {
    mode: {
      label: "Mix mode",
      component: "select",
      options: [
        {
          label: "Add (pointers become extra balls)",
          value: "add"
        },
        {
          label: "Replace (only pointer balls)",
          value: "replace"
        },
        {
          label: "Off (ignore pointers)",
          value: "off"
        }
      ]
    },
    pointerRadius: {
      label: "Pointer ball radius",
      component: "slider",
      min: 10,
      max: 400,
      step: 5
    }
  }
};

export const PALETTE_OPTIONS = [
  {
    label: "Rainbow",
    value: "rainbow"
  },
  {
    label: "Sunset",
    value: "sunset"
  },
  {
    label: "Fire",
    value: "fire"
  },
  {
    label: "Ice",
    value: "ice"
  },
  {
    label: "Magma",
    value: "magma"
  },
  {
    label: "Viridis",
    value: "viridis"
  }
];

export const MOTION_OPTIONS = [
  {
    label: "Drift (looping noise)",
    value: "drift"
  },
  {
    label: "Orbit (looping Lissajous)",
    value: "orbit"
  },
  {
    label: "Bounce (live, no loop)",
    value: "bounce"
  }
];

export const ballsValues = {
  count: 7,
  seed: 7,
  minRadius: 70,
  maxRadius: 160,
  motionMode: "drift",
  motion: 1,
  speed: 1,
  radiusPulse: 0.12
};

export const ballsConfig = {
  label: "Metaballs",
  component: "nested-object",
  fields: {
    count: {
      label: "Ball count",
      component: "slider",
      min: 1,
      max: 40,
      step: 1
    },
    seed: {
      label: "Layout seed",
      component: "slider",
      min: 0,
      max: 999,
      step: 1
    },
    minRadius: {
      label: "Min radius",
      component: "slider",
      min: 5,
      max: 300,
      step: 1
    },
    maxRadius: {
      label: "Max radius",
      component: "slider",
      min: 5,
      max: 400,
      step: 1
    },
    motionMode: {
      label: "Motion mode",
      component: "select",
      options: MOTION_OPTIONS
    },
    motion: {
      label: "Motion amount",
      component: "slider",
      min: 0,
      max: 3,
      step: 0.05
    },
    speed: {
      label: "Speed (snaps to whole turns/loop)",
      component: "slider",
      min: 0,
      max: 6,
      step: 1
    },
    radiusPulse: {
      label: "Radius pulse",
      component: "slider",
      min: 0,
      max: 0.8,
      step: 0.01
    }
  }
};

export const gridValues = {
  cellSize: 22,
  threshold: 1,
  interpolate: true
};

export const gridConfig = {
  label: "Marching grid",
  component: "nested-object",
  fields: {
    cellSize: {
      label: "Cell size (px) — lower = finer",
      component: "slider",
      min: 4,
      max: 80,
      step: 1
    },
    threshold: {
      label: "Iso threshold",
      component: "slider",
      min: 0.2,
      max: 3,
      step: 0.05
    },
    interpolate: {
      label: "Linear interpolation",
      component: "checkbox"
    }
  }
};
