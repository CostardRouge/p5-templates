import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3
  },
  rings: {
    shadowsCount: 10,
    shadowIndexStep: 0.03,
    angleSubdivisions: 6,
    radiusDivisorMin: 1,
    radiusDivisorMax: 5,
    linesCount: 3,
    lineSizeMin: 50,
    lineSizeMax: 150
  },
  motion: {
    spinSpeed: 1,
    rotationSpeed: 3,
    rotationMaxMin: 1,
    rotationMaxMax: 5
  },
  glow: {
    enabled: true,
    ringsCount: 15,
    strokeWeight: 4,
    sizeMin: 0.166,
    sizeMax: 1,
    color: [
      128,
      128,
      255
    ] as number[],
    orbitRadius: 30,
    orbitSpeed: 5
  },
  endcap: {
    weight: 4,
    darken: 32
  },
  colors: {
    opacityFalloffMin: 1,
    opacityFalloffMax: 5,
    weightMaxMin: 50,
    weightMaxMax: 100
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
  layout: {
    component: "nested-object",
    label: "Layout",
    fields: {
      xCount: {
        label: "X count",
        component: "slider",
        min: 1,
        max: 10,
        step: 1
      },
      yCount: {
        label: "Y count",
        component: "slider",
        min: 1,
        max: 10,
        step: 1
      },
      sizeDivisor: {
        label: "Size divisor",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      }
    }
  },
  rings: {
    component: "nested-object",
    label: "Rings",
    fields: {
      shadowsCount: {
        label: "Shadows count",
        component: "slider",
        min: 1,
        max: 100,
        step: 1
      },
      shadowIndexStep: {
        label: "Shadow step",
        component: "slider",
        min: 0.005,
        max: 1,
        step: 0.005
      },
      angleSubdivisions: {
        label: "Angle subdivisions",
        component: "slider",
        min: 2,
        max: 64,
        step: 1
      },
      radiusDivisorMin: {
        label: "Radius divisor min",
        component: "slider",
        min: 0.1,
        max: 5,
        step: 0.05
      },
      radiusDivisorMax: {
        label: "Radius divisor max",
        component: "slider",
        min: 0.5,
        max: 30,
        step: 0.1
      },
      linesCount: {
        label: "Lines per node",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      lineSizeMin: {
        label: "Line size min",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      },
      lineSizeMax: {
        label: "Line size max",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      spinSpeed: {
        label: "Spin speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      rotationSpeed: {
        label: "Rotation speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.01
      },
      rotationMaxMin: {
        label: "Rotation max min",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      rotationMaxMax: {
        label: "Rotation max max",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      }
    }
  },
  glow: {
    component: "nested-object",
    label: "Glow rings",
    fields: {
      enabled: {
        label: "Enabled",
        component: "checkbox"
      },
      ringsCount: {
        label: "Rings count",
        component: "slider",
        min: 0,
        max: 50,
        step: 1
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 1,
        max: 30,
        step: 1
      },
      sizeMin: {
        label: "Size min",
        component: "slider",
        min: 0.05,
        max: 2,
        step: 0.01
      },
      sizeMax: {
        label: "Size max",
        component: "slider",
        min: 0.1,
        max: 5,
        step: 0.01
      },
      color: {
        component: "color",
        label: "Color"
      },
      orbitRadius: {
        label: "Orbit radius",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      orbitSpeed: {
        label: "Orbit speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -20,
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
        label: "Weight",
        component: "slider",
        min: 1,
        max: 30,
        step: 1
      },
      darken: {
        label: "Darken amount",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      opacityFalloffMin: {
        label: "Opacity falloff min",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
      },
      opacityFalloffMax: {
        label: "Opacity falloff max",
        component: "slider",
        min: 1,
        max: 30,
        step: 0.1
      },
      weightMaxMin: {
        label: "Weight max min",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      weightMaxMax: {
        label: "Weight max max",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
