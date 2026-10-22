const sceneOptions = [
  {
    label: "Cycle through the screens",
    value: "cycle"
  },
  {
    label: "Main menu",
    value: "menu"
  },
  {
    label: "Frequency analyzer",
    value: "scanner"
  },
  {
    label: "Raw signal capture",
    value: "signal"
  },
  {
    label: "Card reader",
    value: "reader"
  },
  {
    label: "Typed message",
    value: "message"
  },
  {
    label: "Dithered plasma",
    value: "plasma"
  }
];

export const formValues = {
  program: {
    scene: "cycle",
    include: {
      menu: true,
      scanner: true,
      signal: true,
      reader: true,
      message: true,
      plasma: true
    },
    transition: 0.15,
    invert: false,
    seed: 7
  },
  message: {
    text: "Hack the planet!",
    scale: 2
  },
  display: {
    fill: 0.88,
    gap: 0.12,
    unlit: 0.05,
    shadow: 0.35,
    shadowOpacity: 0.28,
    persistence: 0.22,
    vignette: 0.35,
    glare: 0.1
  },
  bezel: {
    enabled: true,
    padding: 6,
    radius: 5,
    color: [
      28,
      28,
      30
    ] as number[]
  },
  colors: {
    backlight: [
      255,
      130,
      0
    ] as number[],
    ink: [
      22,
      12,
      4
    ] as number[],
    background: [
      14,
      14,
      16
    ] as number[]
  }
};

export const formConfiguration: Record<string, any> = {
  program: {
    component: "nested-object",
    label: "Program",
    fields: {
      scene: {
        label: "Screen",
        component: "select",
        options: sceneOptions
      },
      include: {
        component: "nested-object",
        label: "Screens in the cycle",
        fields: {
          menu: {
            label: "Main menu",
            component: "checkbox"
          },
          scanner: {
            label: "Frequency analyzer",
            component: "checkbox"
          },
          signal: {
            label: "Raw signal capture",
            component: "checkbox"
          },
          reader: {
            label: "Card reader",
            component: "checkbox"
          },
          message: {
            label: "Typed message",
            component: "checkbox"
          },
          plasma: {
            label: "Dithered plasma",
            component: "checkbox"
          }
        }
      },
      transition: {
        label: "Dissolve (share of each screen)",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      invert: {
        label: "Invert (light pixels on dark)",
        component: "checkbox"
      },
      seed: {
        label: "Seed (codes, noise, card ID)",
        component: "slider",
        min: 0,
        max: 999,
        step: 1
      }
    }
  },
  message: {
    component: "nested-object",
    label: "Message",
    fields: {
      text: {
        label: "Text",
        component: "text"
      },
      scale: {
        label: "Text scale (shrinks to fit)",
        component: "slider",
        min: 1,
        max: 4,
        step: 1
      }
    }
  },
  display: {
    component: "nested-object",
    label: "Display",
    fields: {
      fill: {
        label: "Size (share of the canvas)",
        component: "slider",
        min: 0.2,
        max: 1,
        step: 0.01
      },
      gap: {
        label: "Pixel gap",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      unlit: {
        label: "Unlit pixel visibility",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.01
      },
      shadow: {
        label: "Pixel shadow offset",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      shadowOpacity: {
        label: "Pixel shadow opacity",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      persistence: {
        label: "Persistence (slow crystal smear)",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      vignette: {
        label: "Backlight falloff",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      glare: {
        label: "Glass glare",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      }
    }
  },
  bezel: {
    component: "nested-object",
    label: "Bezel",
    fields: {
      enabled: {
        label: "Show bezel",
        component: "checkbox"
      },
      padding: {
        label: "Padding (in LCD pixels)",
        component: "slider",
        min: 0,
        max: 24,
        step: 1
      },
      radius: {
        label: "Corner radius (in LCD pixels)",
        component: "slider",
        min: 0,
        max: 24,
        step: 0.5
      },
      color: {
        label: "Color",
        component: "color"
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      backlight: {
        label: "Backlight",
        component: "color"
      },
      ink: {
        label: "Pixels",
        component: "color"
      },
      background: {
        label: "Background",
        component: "color"
      }
    }
  }
};
