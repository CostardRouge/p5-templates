import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  shape: {
    quality: 400,
    angleBoundMin: 0.5,
    angleBoundMax: Math.PI,
    radiusXDivisor: 4,
    radiusYDivisor: 4
  },
  grid: {
    enabled: true,
    xCount: 5,
    yCount: 6,
    animSpeed: 1
  },
  lines: {
    maxCount: 3,
    changeOverTime: false,
    length: 100,
    weight: 40
  },
  opacity: {
    pingPong: true,
    pingPongMax: 15,
    speed: 3,
    groupCount: 3,
    startFactor: 3,
    endFactor: 1
  },
  rotation: {
    count: 1,
    speed: 2,
    angleSquaredFactor: 0.5
  },
  colors: {
    hueSpeed: 2,
    greenAngleMultiplier: 2.5
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      quality: {
        label: "Quality",
        component: "slider",
        min: 1,
        max: 1600,
        step: 1
      },
      angleBoundMin: {
        label: "Angle bound min",
        component: "slider",
        min: 0.05,
        max: 3.14,
        step: 0.01
      },
      angleBoundMax: {
        label: "Angle bound max",
        component: "slider",
        min: 0.5,
        max: 6.28,
        step: 0.01
      },
      radiusXDivisor: {
        label: "Radius X (width / value)",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      },
      radiusYDivisor: {
        label: "Radius Y (height / value)",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      }
    }
  },
  grid: {
    component: "nested-object",
    label: "Background grid",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox"
      },
      xCount: {
        label: "X count",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      yCount: {
        label: "Y count",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      animSpeed: {
        label: "Anim speed",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      }
    }
  },
  lines: {
    component: "nested-object",
    label: "Lines",
    fields: {
      maxCount: {
        label: "Max lines count",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
      },
      changeOverTime: {
        label: "Change lines count over time",
        component: "checkbox"
      },
      length: {
        label: "Lines length",
        component: "slider",
        min: 1,
        max: 400,
        step: 1
      },
      weight: {
        label: "Lines weight",
        component: "slider",
        min: 1,
        max: 300,
        step: 1
      }
    }
  },
  opacity: {
    component: "nested-object",
    label: "Opacity",
    fields: {
      pingPong: {
        label: "Ping-pong opacity",
        component: "checkbox"
      },
      pingPongMax: {
        label: "Ping-pong max",
        component: "slider",
        min: 1,
        max: 100,
        step: 1
      },
      speed: {
        label: "Opacity speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      groupCount: {
        label: "Opacity group count",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
      },
      startFactor: {
        label: "Start factor",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.1
      },
      endFactor: {
        label: "End factor",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.1
      }
    }
  },
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      count: {
        label: "Rotation count",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      speed: {
        label: "Rotation speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.01
      },
      angleSquaredFactor: {
        label: "Angle² factor (curl)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      hueSpeed: {
        label: "Hue speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.01
      },
      greenAngleMultiplier: {
        label: "Green angle multiplier",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      }
    }
  },
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
