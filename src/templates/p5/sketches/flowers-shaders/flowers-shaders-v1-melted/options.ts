
export const formValues = {
  timeScale: 2.2,
  path: {
    boundary: 263,
    step: 0.003 / 250,
    anchorTimeScale: 0.25,
    easing: "linear"
  },
  flower: {
    sides: 3,
    flowerPetals: 5,
    sizeMin: 113,
    sizeMax: 310,
    rotationSpeed: -0.98,
    innerRotationGain: 16.2,
    borderWidth: 0,
    borderDarken: 0
  },
  colors: {
    hueSpeed: 0.02,
    hueSpread: 3.48,
    huePhase: 0,
    pathHueShift: -6.28,
    sideHueShift: 3.56,
    petalHueShift: 1.32,
    shimmer: 2.5,
    saturation: 1,
    brightness: 2
  },
  aberration: {
    amount: 0,
    mode: "radial" as "radial" | "horizontal"
  },
  backgroundColor: [
    0,
    0,
    0
  ]
};

export const formConfiguration: Record<string, any> = {
  timeScale: {
    label: "Time scale",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.01
  },
  path: {
    component: "nested-object",
    label: "Path (eased 3 anchors)",
    fields: {
      boundary: {
        label: "Boundary px",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      step: {
        label: "Step (smaller = denser)",
        component: "slider",
        min: 0.002,
        max: 0.05,
        step: 0.0005
      },
      anchorTimeScale: {
        label: "Anchor cycle speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      easing: {
        label: "Anchor easing",
        component: "easing"
      }
    }
  },
  flower: {
    component: "nested-object",
    label: "Flowers",
    fields: {
      sides: {
        label: "Cluster flowers (sides)",
        component: "slider",
        min: 1,
        max: 16,
        step: 1
      },
      flowerPetals: {
        label: "Petals per flower",
        component: "slider",
        min: 3,
        max: 32,
        step: 1
      },
      sizeMin: {
        label: "Size min",
        component: "slider",
        min: 0,
        max: 400,
        step: 1
      },
      sizeMax: {
        label: "Size max",
        component: "slider",
        min: 10,
        max: 1200,
        step: 1
      },
      rotationSpeed: {
        label: "Rotation speed (snaps to whole turns/loop)",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      },
      innerRotationGain: {
        label: "Inner rotation gain",
        component: "slider",
        min: 0,
        max: 30,
        step: 0.1
      },
      borderWidth: {
        label: "Outline width px",
        component: "slider",
        min: 0,
        max: 30,
        step: 0.5
      },
      borderDarken: {
        label: "Outline darken (0 = black)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Iridescent",
    fields: {
      hueSpeed: {
        label: "Hue speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.01
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0.1,
        max: 6,
        step: 0.01
      },
      huePhase: {
        label: "Hue phase",
        component: "slider",
        min: 0,
        max: 6.2832,
        step: 0.01
      },
      pathHueShift: {
        label: "Path hue shift",
        component: "slider",
        min: -6.2832,
        max: 6.2832,
        step: 0.01
      },
      sideHueShift: {
        label: "Flower hue shift",
        component: "slider",
        min: -6.2832,
        max: 6.2832,
        step: 0.01
      },
      petalHueShift: {
        label: "Petal hue shift",
        component: "slider",
        min: -6.2832,
        max: 6.2832,
        step: 0.01
      },
      shimmer: {
        label: "Shimmer",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.01
      },
      saturation: {
        label: "Saturation",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      }
    }
  },
  aberration: {
    component: "nested-object",
    label: "Chromatic aberration",
    fields: {
      amount: {
        label: "Amount px (0 = off)",
        component: "slider",
        min: 0,
        max: 40,
        step: 0.5
      },
      mode: {
        label: "Direction",
        component: "select",
        options: [
          {
            label: "Radial",
            value: "radial"
          },
          {
            label: "Horizontal",
            value: "horizontal"
          }
        ]
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
