
export const formValues = {
  shape: {
    quality: 500,
    angleMaxOffset: 0.5,
    radiusXDivisor: 3,
    radiusYDivisor: 3,
    xCoefficient: 1,
    yCoefficient: 1
  },
  lines: {
    maxCount: 3,
    changeOverTime: false,
    length: 50,
    weight: 20
  },
  opacity: {
    pingPong: false,
    pingPongMax: 50,
    speed: 3,
    groupCount: 6,
    startFactor: 6,
    endFactor: 1
  },
  rotation: {
    count: 1,
    speed: 2
  },
  colors: {
    hueSpeed: 2,
    greenAngleMultiplier: 1,
    blueAngleMultiplier: 1
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ]
};

export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      quality: {
        label: "Quality (segments)",
        component: "slider",
        min: 1,
        max: 1600,
        step: 1
      },
      angleMaxOffset: {
        label: "Angle gap (TAU − offset)",
        component: "slider",
        min: 0,
        max: 3.14,
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
        label: "Radius Y (width / value)",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      },
      xCoefficient: {
        label: "X coefficient",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
      },
      yCoefficient: {
        label: "Y coefficient",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
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
        label: "Ping-pong max factor",
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
        label: "Start factor (reduction)",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.1
      },
      endFactor: {
        label: "End factor (reduction)",
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
      greenAngleMultiplier: {
        label: "Green angle multiplier",
        component: "slider",
        min: 0,
        max: 16,
        step: 0.1
      },
      blueAngleMultiplier: {
        label: "Blue angle multiplier",
        component: "slider",
        min: 0,
        max: 16,
        step: 0.1
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
