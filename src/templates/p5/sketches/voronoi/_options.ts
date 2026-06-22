// Shared form fragments for the "voronoi" category.

import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

export {
  interactionFormConfiguration
};

// Interaction defaults: every source starts OFF and the debug overlay is muted,
// so the procedural diagram is unchanged until the user enables a source. Then
// each pointer (Mouse / Vision / Audio / Orbit / Gyroscope) becomes a live site.
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
  mode: "add"
};

export const interactionMixConfig = {
  label: "Interaction → sites",
  component: "nested-object",
  fields: {
    mode: {
      label: "Mix mode",
      component: "select",
      options: [
        {
          label: "Add (pointers become extra sites)",
          value: "add"
        },
        {
          label: "Replace (only pointer sites)",
          value: "replace"
        },
        {
          label: "Off (ignore pointers)",
          value: "off"
        }
      ]
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

export const METRIC_OPTIONS = [
  {
    label: "Euclidean",
    value: "euclidean"
  },
  {
    label: "Manhattan",
    value: "manhattan"
  },
  {
    label: "Chebyshev",
    value: "chebyshev"
  },
  {
    label: "Minkowski (p)",
    value: "minkowski"
  }
];

export const LAYOUT_OPTIONS = [
  {
    label: "Random",
    value: "random"
  },
  {
    label: "Grid jitter",
    value: "grid-jitter"
  },
  {
    label: "Ring",
    value: "ring"
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

export const sitesValues = {
  count: 24,
  seed: 7,
  layout: "random",
  motionMode: "drift",
  motion: 1,
  speed: 1
};

export const sitesConfig = {
  label: "Sites",
  component: "nested-object",
  fields: {
    count: {
      label: "Site count",
      component: "slider",
      min: 2,
      max: 120,
      step: 1
    },
    seed: {
      label: "Layout seed",
      component: "slider",
      min: 0,
      max: 999,
      step: 1
    },
    layout: {
      label: "Layout",
      component: "select",
      options: LAYOUT_OPTIONS
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
      label: "Speed (integer loops best)",
      component: "slider",
      min: 0,
      max: 6,
      step: 1
    }
  }
};

export const metricValues = {
  metric: "euclidean",
  minkowskiP: 3,
  resolution: 240
};

export const metricConfig = {
  label: "Distance & quality",
  component: "nested-object",
  fields: {
    metric: {
      label: "Distance metric",
      component: "select",
      options: METRIC_OPTIONS
    },
    minkowskiP: {
      label: "Minkowski exponent p",
      component: "slider",
      min: 0.5,
      max: 8,
      step: 0.1
    },
    resolution: {
      label: "Resolution (buffer columns)",
      component: "slider",
      min: 60,
      max: 600,
      step: 10
    }
  }
};
