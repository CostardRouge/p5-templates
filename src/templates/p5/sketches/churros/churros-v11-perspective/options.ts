import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  shape: {
    quality: 400,
    angleBoundA: 2 * Math.PI - 0.3,
    angleBoundB: 0,
    spiralRadius: -360
  },
  scene: {
    spinSpeed: 1
  },
  grid: {
    enabled: true,
    xCount: 3,
    yCount: 3,
    animSpeed: 1
  },
  guides: {
    enabled: true,
    showStart: true,
    showEnd: true,
    weight: 4,
    color: [
      128,
      128,
      255,
      255
    ]
  },
  lines: {
    maxCount: 2,
    changeOverTime: false,
    length: 100,
    weight: 40,
    angleMax: Math.PI
  },
  opacity: {
    pingPong: false,
    pingPongMax: 15,
    speed: 3,
    groupCount: 3,
    startFactor: 3,
    endFactor: 1
  },
  rotation: {
    count: 1,
    speed: 2,
    spinFreq: 3
  },
  colors: {
    hueSpeed: 2,
    hueRedAngleMultiplier: 5,
    hueGreenAngleMultiplier: 3
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
      angleBoundA: {
        label: "Angle bound A",
        component: "slider",
        min: 0.5,
        max: 12,
        step: 0.01
      },
      angleBoundB: {
        label: "Angle bound B",
        component: "slider",
        min: -3,
        max: 12,
        step: 0.01
      },
      spiralRadius: {
        label: "Spiral radius (signed)",
        component: "slider",
        min: -800,
        max: 800,
        step: 1
      }
    }
  },
  scene: {
    component: "nested-object",
    label: "Scene",
    fields: {
      spinSpeed: {
        label: "Scene spin speed (snaps to whole turns/loop)",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
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
        min: 0,
        max: 20,
        step: 1
      },
      yCount: {
        label: "Y count",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      },
      animSpeed: {
        label: "Anim speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      }
    }
  },
  guides: {
    component: "nested-object",
    label: "Endpoint guides",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox"
      },
      showStart: {
        label: "Show start",
        component: "checkbox"
      },
      showEnd: {
        label: "Show end",
        component: "checkbox"
      },
      weight: {
        label: "Guide weight",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      color: {
        label: "Guide color",
        component: "color"
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
      },
      angleMax: {
        label: "Line angle max",
        component: "slider",
        min: 0.1,
        max: 6.28,
        step: 0.01
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
        label: "Opacity speed (snaps to whole cycles/loop)",
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
      spinFreq: {
        label: "Spin freq",
        component: "slider",
        min: 0,
        max: 12,
        step: 0.1
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      hueSpeed: {
        label: "Hue speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.01
      },
      hueRedAngleMultiplier: {
        label: "Red angle multiplier",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      hueGreenAngleMultiplier: {
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
