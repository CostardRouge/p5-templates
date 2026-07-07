import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  // Square-edged swap tiles read best; keep them gap-tight by default.
  cornerRadius: 0,
  gap: 0,
  shadow: {
    enabled: false,
    blur: 40,
    opacity: 0.35,
    y: 24
  },

  swap: false,
  splitAxis: "horizontal",
  splitRatio: 0.5,
  dividerWidth: 0,
  dividerColor: [
    255,
    255,
    255
  ],

  columns: 1,
  rows: 2,
  tileSize: 0.3,
  centerX: 0.5,
  centerY: 0.5,

  transition: "none",
  direction: "up",
  pattern: "checker",
  angle: 128,
  tileScale: 0,
  tileRotate: 173,
  spread: 0.51,
  overlayOpacity: 1,
  blendMode: "normal",
  perspective: 850,
  breathing: 0,
  seed: 1
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  swap: {
    component: "checkbox",
    label: "Swap images"
  },
  splitAxis: {
    component: "select",
    label: "Split axis",
    options: [
      {
        label: "Vertical (side by side)",
        value: "vertical"
      },
      {
        label: "Horizontal (top / bottom)",
        value: "horizontal"
      }
    ]
  },
  splitRatio: {
    component: "slider",
    label: "Split position",
    min: 0.05,
    max: 0.95,
    step: 0.01
  },
  dividerWidth: {
    component: "slider",
    label: "Divider width",
    min: 0,
    max: 40,
    step: 1
  },
  dividerColor: {
    component: "color",
    label: "Divider color"
  },
  columns: {
    component: "slider",
    label: "Swap tiles across",
    min: 1,
    max: 12,
    step: 1
  },
  rows: {
    component: "slider",
    label: "Swap tiles down",
    min: 1,
    max: 12,
    step: 1
  },
  tileSize: {
    component: "slider",
    label: "Tile size",
    min: 0.05,
    max: 0.9,
    step: 0.01
  },
  centerX: {
    component: "slider",
    label: "Tiles center X",
    min: 0,
    max: 1,
    step: 0.01
  },
  centerY: {
    component: "slider",
    label: "Tiles center Y",
    min: 0,
    max: 1,
    step: 0.01
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
    label: "Swap opacity",
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
