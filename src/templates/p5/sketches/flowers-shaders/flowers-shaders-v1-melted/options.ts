import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  timeScale: 2.2,
  path: {
    boundary: 147,
    step: 1 / 250,
    anchorTimeScale: 0.25,
    easing: "linear"
  },
  flower: {
    sides: 2,
    flowerPetals: 5,
    sizeMin: 99,
    sizeMax: 293,
    rotationSpeed: 0.39,
    innerRotationGain: 9.8,
    borderWidth: 2,
    borderDarken: 0
  },
  colors: {
    hueSpeed: 1,
    hueSpread: 1.5,
    huePhase: 0,
    pathHueShift: 1.5,
    sideHueShift: 0.6,
    petalHueShift: 0.25,
    shimmer: 1.8,
    saturation: 1,
    brightness: 1
  },
  aberration: {
    amount: 0,
    mode: "radial" as "radial" | "horizontal"
  },
  backgroundColor: [
    0,
    0,
    0
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
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
        label: "Anchor cycle speed",
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
        label: "Rotation speed",
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
        label: "Hue speed",
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
  },
  title: titleFormConfiguration
};
