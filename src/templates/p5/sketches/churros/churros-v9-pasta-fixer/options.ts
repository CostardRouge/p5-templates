import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  shape: {
    quality: 400,
    angleMax: Math.PI,
    horizontalSwing: 200,
    horizontalSwingSpeed: 2,
    verticalMargin: 150,
    lineAngleMin: -Math.PI,
    lineAngleMax: Math.PI
  },
  cursor: {
    enabled: true,
    speed: 150,
    rotationMultiplier: 4,
    markerSize: 300,
    opacityBoost: 1.5,
    color: [
      128,
      128,
      255,
      255
    ]
  },
  grid: {
    enabled: true,
    xCount: 2,
    yCount: 2,
    animSpeed: 1
  },
  lines: {
    maxCount: 2,
    changeOverTime: false,
    length: 75,
    weight: 80
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
    speed: 2
  },
  colors: {
    hueSpeed: 2,
    hueAngleMultiplier: 5
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
      angleMax: {
        label: "Angle max",
        component: "slider",
        min: 0.5,
        max: 6.28,
        step: 0.01
      },
      horizontalSwing: {
        label: "Horizontal swing",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      horizontalSwingSpeed: {
        label: "Horizontal swing speed",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.01
      },
      verticalMargin: {
        label: "Vertical margin",
        component: "slider",
        min: 0,
        max: 400,
        step: 1
      },
      lineAngleMin: {
        label: "Line angle min",
        component: "slider",
        min: -6.28,
        max: 0,
        step: 0.01
      },
      lineAngleMax: {
        label: "Line angle max",
        component: "slider",
        min: 0,
        max: 6.28,
        step: 0.01
      }
    }
  },
  cursor: {
    component: "nested-object",
    label: "Cursor (scanning effect)",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox"
      },
      speed: {
        label: "Cursor speed (Hz·quality)",
        component: "slider",
        min: 1,
        max: 600,
        step: 1
      },
      rotationMultiplier: {
        label: "Past-cursor rotation multiplier",
        component: "slider",
        min: 0,
        max: 16,
        step: 0.1
      },
      markerSize: {
        label: "Marker circle size",
        component: "slider",
        min: 0,
        max: 800,
        step: 1
      },
      opacityBoost: {
        label: "Pre-cursor opacity boost",
        component: "slider",
        min: 0.5,
        max: 5,
        step: 0.01
      },
      color: {
        label: "Marker color",
        component: "color"
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
      hueAngleMultiplier: {
        label: "Hue angle multiplier",
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
