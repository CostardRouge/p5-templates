import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  grid: {
    rows: 3,
    columns: 3
  },
  margin: 64,
  staggerOrigin: "diagonal",
  revealStyle: "clip",
  revealDirection: "up",
  timing: {
    revealFraction: 0.4,
    holdFraction: 0.2
  },
  breathing: 0.04
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      rows: {
        component: "slider",
        label: "Rows",
        min: 1,
        max: 12,
        step: 1
      },
      columns: {
        component: "slider",
        label: "Columns",
        min: 1,
        max: 12,
        step: 1
      }
    }
  },
  margin: {
    component: "slider",
    label: "Outer margin",
    min: 0,
    max: 320,
    step: 1
  },
  staggerOrigin: {
    component: "select",
    label: "Cascade origin",
    options: [
      {
        label: "Diagonal",
        value: "diagonal"
      },
      {
        label: "Center",
        value: "center"
      },
      {
        label: "Edges",
        value: "edges"
      },
      {
        label: "Rows",
        value: "rows"
      },
      {
        label: "Columns",
        value: "columns"
      },
      {
        label: "Random",
        value: "random"
      }
    ]
  },
  revealStyle: {
    component: "select",
    label: "Reveal style",
    options: [
      {
        label: "Clip wipe",
        value: "clip"
      },
      {
        label: "Scale",
        value: "scale"
      },
      {
        label: "Fade",
        value: "fade"
      },
      {
        label: "Flip 3D",
        value: "flip"
      },
      {
        label: "Rise",
        value: "rise"
      }
    ]
  },
  revealDirection: {
    component: "select",
    label: "Direction",
    options: [
      {
        label: "Up",
        value: "up"
      },
      {
        label: "Down",
        value: "down"
      },
      {
        label: "Left",
        value: "left"
      },
      {
        label: "Right",
        value: "right"
      }
    ]
  },
  timing: {
    component: "nested-object",
    label: "Timing",
    fields: {
      revealFraction: {
        component: "slider",
        label: "Reveal portion",
        min: 0.1,
        max: 0.8,
        step: 0.01
      },
      holdFraction: {
        component: "slider",
        label: "Hold portion",
        min: 0,
        max: 0.8,
        step: 0.01
      }
    }
  },
  breathing: {
    component: "slider",
    label: "Breathing zoom",
    min: 0,
    max: 0.15,
    step: 0.005
  }
};
