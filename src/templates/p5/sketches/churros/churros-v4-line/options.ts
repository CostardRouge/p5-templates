import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  shape: {
    quality: 400,
    verticalMargin: 150,
    lineAngleSpan: Math.PI,
    lineLengthOscillation: 2
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
    length: 75,
    weight: 20
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
    speed: 2
  },
  colors: {
    hueSpeed: 2,
    hueAngleMultiplier: 1
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
      verticalMargin: {
        label: "Vertical margin (px)",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      lineAngleSpan: {
        label: "Line angle span",
        component: "slider",
        min: 0.1,
        max: 6.28,
        step: 0.01
      },
      lineLengthOscillation: {
        label: "Line length oscillation (time term snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 8,
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
        label: "Anim speed (snaps to whole screen-widths/heights per loop)",
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
        label: "Rotation speed (snaps to whole turns/loop)",
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
        label: "Hue speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.01
      },
      hueAngleMultiplier: {
        label: "Red angle multiplier",
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
