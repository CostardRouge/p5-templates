import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  // The tiled reveal reads best edge-to-edge, so start gap-less and square.
  cornerRadius: 0,
  gap: 0,
  shadow: {
    enabled: false,
    blur: 40,
    opacity: 0.35,
    y: 24
  },

  swap: false,
  grid: {
    rows: 6,
    columns: 5
  },
  pattern: "wave",
  angle: 135,
  transition: "scale",
  direction: "up",
  tileScale: 0,
  tileRotate: 0,
  spread: 0.55,
  overlayOpacity: 1,
  blendMode: "normal",
  perspective: 1200,
  breathing: 0,
  seed: 7
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  swap: {
    component: "checkbox",
    label: "Swap images"
  },
  grid: {
    component: "nested-object",
    label: "Tiles",
    fields: {
      rows: {
        component: "slider",
        label: "Rows",
        min: 1,
        max: 24,
        step: 1
      },
      columns: {
        component: "slider",
        label: "Columns",
        min: 1,
        max: 24,
        step: 1
      }
    }
  },
  pattern: {
    component: "select",
    label: "Reveal pattern",
    options: [
      {
        label: "Wave",
        value: "wave"
      },
      {
        label: "Checker",
        value: "checker"
      },
      {
        label: "Random",
        value: "random"
      },
      {
        label: "Radial",
        value: "radial"
      },
      {
        label: "Spiral",
        value: "spiral"
      },
      {
        label: "Rows",
        value: "rows"
      },
      {
        label: "Columns",
        value: "columns"
      }
    ]
  },
  angle: {
    component: "slider",
    label: "Wave angle",
    min: 0,
    max: 360,
    step: 1
  },
  transition: {
    component: "select",
    label: "Tile transition",
    options: [
      {
        label: "None (static)",
        value: "none"
      },
      {
        label: "Fade",
        value: "fade"
      },
      {
        label: "Scale",
        value: "scale"
      },
      {
        label: "Flip",
        value: "flip"
      },
      {
        label: "Slide",
        value: "slide"
      },
      {
        label: "Wipe",
        value: "wipe"
      }
    ]
  },
  direction: {
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
  tileScale: {
    component: "slider",
    label: "Tile enter scale",
    min: 0,
    max: 2,
    step: 0.01
  },
  tileRotate: {
    component: "slider",
    label: "Tile enter rotation",
    min: -180,
    max: 180,
    step: 1
  },
  spread: {
    component: "slider",
    label: "Stagger spread",
    min: 0,
    max: 0.95,
    step: 0.01
  },
  overlayOpacity: {
    component: "slider",
    label: "Mix opacity",
    min: 0,
    max: 1,
    step: 0.01
  },
  blendMode: {
    component: "select",
    label: "Blend mode",
    options: [
      {
        label: "Normal",
        value: "normal"
      },
      {
        label: "Multiply",
        value: "multiply"
      },
      {
        label: "Screen",
        value: "screen"
      },
      {
        label: "Overlay",
        value: "overlay"
      },
      {
        label: "Soft light",
        value: "soft-light"
      },
      {
        label: "Hard light",
        value: "hard-light"
      },
      {
        label: "Difference",
        value: "difference"
      },
      {
        label: "Exclusion",
        value: "exclusion"
      },
      {
        label: "Hue",
        value: "hue"
      },
      {
        label: "Color",
        value: "color"
      },
      {
        label: "Luminosity",
        value: "luminosity"
      }
    ]
  },
  perspective: {
    component: "slider",
    label: "Flip perspective",
    min: 400,
    max: 3000,
    step: 10
  },
  breathing: {
    component: "slider",
    label: "Breathing zoom",
    min: 0,
    max: 0.3,
    step: 0.01
  },
  seed: {
    component: "slider",
    label: "Seed",
    min: 1,
    max: 999,
    step: 1
  }
};
