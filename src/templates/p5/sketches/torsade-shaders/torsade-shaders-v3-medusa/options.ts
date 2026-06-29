import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3
  },
  rings: {
    angleSubdivisions: 6,
    linesCount: 3,
    shadowsCount: 10,
    shadowIndexStep: 0.03,
    radiusDivisorMin: 1,
    radiusDivisorMax: 5,
    lineSizeMin: 50,
    lineSizeMax: 150
  },
  motion: {
    spinSpeed: 1,
    rotationSpeed: 3,
    rotationMaxMin: 1,
    rotationMaxMax: 5
  },
  colors: {
    weightMaxMin: 50,
    weightMaxMax: 100,
    hueSpeed: 1,
    hueSpread: 1,
    huePhase: 0,
    depthHue: 1,
    saturation: 1,
    brightness: 1,
    opacityFalloffMin: 1,
    opacityFalloffMax: 5
  },
  endcap: {
    weight: 4,
    darken: 32
  },
  glow: {
    enabled: true,
    ringsCount: 15,
    sizeMin: 0.166,
    sizeMax: 1,
    orbitRadius: 30,
    orbitSpeed: 5,
    color: [
      128,
      128,
      255
    ],
    strokeWeight: 4
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

// UI configuration only
export const formConfiguration: Record<string, any> = {
  layout: {
    component: "nested-object",
    label: "Layout",
    fields: {
      xCount: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      yCount: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      sizeDivisor: {
        label: "Cell size divisor",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.1
      }
    }
  },
  rings: {
    component: "nested-object",
    label: "Rings",
    fields: {
      angleSubdivisions: {
        label: "Tentacle directions",
        component: "slider",
        min: 1,
        max: 64,
        step: 1
      },
      linesCount: {
        label: "Dots per cluster",
        component: "slider",
        min: 1,
        max: 32,
        step: 1
      },
      shadowsCount: {
        label: "Depth (shadows count)",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      shadowIndexStep: {
        label: "Shadow index step",
        component: "slider",
        min: 0.01,
        max: 0.5,
        step: 0.01
      },
      radiusDivisorMin: {
        label: "Radius divisor min",
        component: "slider",
        min: 0.05,
        max: 10,
        step: 0.05
      },
      radiusDivisorMax: {
        label: "Radius divisor max",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      },
      lineSizeMin: {
        label: "Line size min",
        component: "slider",
        min: 1,
        max: 400,
        step: 1
      },
      lineSizeMax: {
        label: "Line size max",
        component: "slider",
        min: 1,
        max: 600,
        step: 1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      spinSpeed: {
        label: "Spin speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      rotationSpeed: {
        label: "Rotation speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      rotationMaxMin: {
        label: "Rotation depth min",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      rotationMaxMax: {
        label: "Rotation depth max",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      weightMaxMin: {
        label: "Base weight min",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      },
      weightMaxMax: {
        label: "Base weight max",
        component: "slider",
        min: 1,
        max: 400,
        step: 1
      },
      hueSpeed: {
        label: "Hue speed",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      huePhase: {
        label: "Hue phase",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      depthHue: {
        label: "Depth hue shift",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      saturation: {
        label: "Saturation",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      opacityFalloffMin: {
        label: "Opacity falloff min",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      opacityFalloffMax: {
        label: "Opacity falloff max",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      }
    }
  },
  endcap: {
    component: "nested-object",
    label: "Endcap",
    fields: {
      weight: {
        label: "Endcap weight",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.5
      },
      darken: {
        label: "Endcap darken",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      }
    }
  },
  glow: {
    component: "nested-object",
    label: "Glow",
    fields: {
      enabled: {
        label: "Enable glow?",
        component: "checkbox"
      },
      ringsCount: {
        label: "Glow rings count",
        component: "slider",
        min: 1,
        max: 64,
        step: 1
      },
      sizeMin: {
        label: "Glow size min",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      sizeMax: {
        label: "Glow size max",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      orbitRadius: {
        label: "Orbit radius (px)",
        component: "slider",
        min: 0,
        max: 300,
        step: 1
      },
      orbitSpeed: {
        label: "Orbit speed",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      color: {
        label: "Glow color",
        component: "color"
      },
      strokeWeight: {
        label: "Glow stroke weight",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.5
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
