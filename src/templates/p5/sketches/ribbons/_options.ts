import {
  PALETTE_OPTIONS
} from "./_shared.js";

export const linesFormValues = ( overrides: Record<string, any> = {} ) => ( {
  length: 40,
  weight: 80,
  maxCount: 1,
  changeCount: false,
  regularLength: true,
  ...overrides
} );

export const linesFormConfiguration = ( extras: Record<string, any> = {} ) => ( {
  component: "nested-object",
  label: "Lines",
  fields: {
    length: {
      component: "slider",
      label: "Lines length",
      min: 1,
      max: 500,
      step: 1
    },
    weight: {
      component: "slider",
      label: "Lines weight",
      min: 1,
      max: 500,
      step: 1
    },
    maxCount: {
      component: "slider",
      label: "Max lines count",
      min: 1,
      max: 10,
      step: 0.1
    },
    changeCount: {
      component: "checkbox",
      label: "Change lines count over time"
    },
    regularLength: {
      component: "checkbox",
      label: "Regular lines length"
    },
    ...extras
  }
} );

export const opacityFormValues = ( overrides: Record<string, any> = {} ) => ( {
  pingPong: false,
  speed: 3,
  groupCount: 2,
  startFactor: 3,
  endFactor: 1,
  ...overrides
} );

export const opacityFormConfiguration = () => ( {
  component: "nested-object",
  label: "Opacity",
  fields: {
    pingPong: {
      component: "checkbox",
      label: "Ping pong opacity"
    },
    speed: {
      component: "slider",
      label: "Speed (snaps to whole cycles/loop)",
      min: -10,
      max: 10,
      step: 0.1
    },
    groupCount: {
      component: "slider",
      label: "Group count",
      min: 1,
      max: 10,
      step: 0.1
    },
    startFactor: {
      component: "slider",
      label: "Start opacity factor",
      min: 1,
      max: 50,
      step: 0.1
    },
    endFactor: {
      component: "slider",
      label: "End opacity factor",
      min: 1,
      max: 50,
      step: 0.1
    }
  }
} );

export const rotationFormValues = ( overrides: Record<string, any> = {} ) => ( {
  count: 1,
  speed: 1,
  indexMultiplier: 2,
  wobble: 0,
  ...overrides
} );

export const rotationFormConfiguration = ( extras: Record<string, any> = {} ) => ( {
  component: "nested-object",
  label: "Rotation",
  fields: {
    count: {
      component: "slider",
      label: "Rotation count",
      min: -5,
      max: 5,
      step: 0.01
    },
    speed: {
      component: "slider",
      label: "Rotation speed",
      min: -10,
      max: 10,
      step: 0.1
    },
    indexMultiplier: {
      component: "slider",
      label: "Index multiplier",
      min: -5,
      max: 5,
      step: 0.01
    },
    wobble: {
      component: "slider",
      label: "Wobble amplitude",
      min: -3,
      max: 3,
      step: 0.01
    },
    ...extras
  }
} );

export const colorsFormValues = ( overrides: Record<string, any> = {} ) => ( {
  hueSpeed: 2,
  palette: "rainbow" as string,
  ...overrides
} );

export const colorsFormConfiguration = ( extras: Record<string, any> = {} ) => ( {
  component: "nested-object",
  label: "Colors",
  fields: {
    hueSpeed: {
      component: "slider",
      label: "Hue speed (snaps to whole cycles/loop)",
      min: -10,
      max: 10,
      step: 0.1
    },
    palette: {
      component: "select",
      label: "Palette",
      options: PALETTE_OPTIONS
    },
    ...extras
  }
} );

export const shapeFormValues = ( quality = 400 ) => ( {
  quality
} );

export const shapeFormConfiguration = ( extras: Record<string, any> = {} ) => ( {
  component: "nested-object",
  label: "Shape",
  fields: {
    quality: {
      component: "slider",
      label: "Quality (lerp steps)",
      min: 50,
      max: 2000,
      step: 1
    },
    ...extras
  }
} );

export const tintFormValues = (
  rgb: number[] = [
    128,
    128,
    255
  ], alpha = 60
) => ( {
  tint: rgb,
  alpha
} );

export const tintFormConfiguration = (
  tintLabel = "Pattern tint",
  alphaLabel = "Pattern alpha",
  alphaMax = 255
) => ( {
  component: "nested-object",
  label: "Background pattern",
  fields: {
    tint: {
      component: "color",
      label: tintLabel
    },
    alpha: {
      component: "slider",
      label: alphaLabel,
      min: 0,
      max: alphaMax,
      step: 1
    }
  }
} );

export const blurredBackgroundFormValues = ( overrides: Record<string, any> = {} ) => ( {
  enabled: true,
  blur: 2,
  pixelDensity: 0.1,
  trailAlpha: 16,
  linesAmount: 60,
  linesWeight: 10,
  radialAlpha: 40,
  tint: [
    128,
    128,
    255
  ] as number[],
  radiusXMult: 1.5,
  radiusYMult: 2,
  animationSpeed: 0.25,
  ...overrides
} );

export const blurredBackgroundFormConfiguration = ( extras: Record<string, any> = {} ) => ( {
  component: "nested-object",
  label: "Blurred background",
  fields: {
    enabled: {
      component: "checkbox",
      label: "Enabled"
    },
    blur: {
      component: "slider",
      label: "Blur amount",
      min: 0,
      max: 12,
      step: 0.1
    },
    pixelDensity: {
      component: "slider",
      label: "Pixel density",
      min: 0.01,
      max: 1,
      step: 0.01
    },
    trailAlpha: {
      component: "slider",
      label: "Trail alpha",
      min: 0,
      max: 60,
      step: 1
    },
    linesAmount: {
      component: "slider",
      label: "Radial lines amount",
      min: 1,
      max: 600,
      step: 1
    },
    linesWeight: {
      component: "slider",
      label: "Radial lines weight",
      min: 0,
      max: 30,
      step: 0.5
    },
    radialAlpha: {
      component: "slider",
      label: "Radial alpha",
      min: 0,
      max: 255,
      step: 1
    },
    tint: {
      component: "color",
      label: "Radial tint"
    },
    radiusXMult: {
      component: "slider",
      label: "Radial X radius mult",
      min: 0,
      max: 5,
      step: 0.01
    },
    radiusYMult: {
      component: "slider",
      label: "Radial Y radius mult",
      min: 0,
      max: 5,
      step: 0.01
    },
    animationSpeed: {
      component: "slider",
      label: "Radial animation speed",
      min: -2,
      max: 2,
      step: 0.01
    },
    ...extras
  }
} );

export const lineSpreadFormValues = ( overrides: Record<string, any> = {} ) => ( {
  lineMinFraction: -1,
  lineMaxFraction: 1,
  ...overrides
} );

export const lineSpreadFormConfiguration = () => ( {
  lineMinFraction: {
    component: "slider",
    label: "Line min (× PI)",
    min: -2,
    max: 2,
    step: 0.01
  },
  lineMaxFraction: {
    component: "slider",
    label: "Line max (× PI)",
    min: -2,
    max: 2,
    step: 0.01
  }
} );
