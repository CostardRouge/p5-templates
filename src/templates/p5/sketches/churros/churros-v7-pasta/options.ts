
export const formValues = {
  shape: {
    quality: 435,
    angleBoundMin: 2.18,
    angleBoundMax: 4.04,
    horizontalSwing: 292,
    horizontalSwingFreq: 2.4,
    horizontalSwingSpeed: 0,
    verticalMargin: 0,
    lineAngleMax: 0.41000000000000003
  },
  grids: {
    outerEnabled: true,
    outerXCount: 1,
    outerYCount: 1,
    outerAnimSpeed: 1,
    innerEnabled: true,
    innerXCount: 3,
    innerYCount: 4,
    innerAnimSpeed: 1
  },
  lines: {
    maxCount: 3,
    changeOverTime: true,
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
    speed: 2,
    waveAmplitude: 1.5,
    waveMultiplier: 2
  },
  colors: {
    hueSpeed: 2,
    hueAngleMultiplier: 7
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
      horizontalSwing: {
        label: "Horizontal swing (px)",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      horizontalSwingFreq: {
        label: "Horizontal swing freq",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.1
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
      lineAngleMax: {
        label: "Line angle max",
        component: "slider",
        min: 0.1,
        max: 6.28,
        step: 0.01
      }
    }
  },
  grids: {
    component: "nested-object",
    label: "Background grids",
    fields: {
      outerEnabled: {
        label: "Outer grid enabled?",
        component: "checkbox"
      },
      outerXCount: {
        label: "Outer X count",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      },
      outerYCount: {
        label: "Outer Y count",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      },
      outerAnimSpeed: {
        label: "Outer anim speed",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      innerEnabled: {
        label: "Inner grid enabled?",
        component: "checkbox"
      },
      innerXCount: {
        label: "Inner X count",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      },
      innerYCount: {
        label: "Inner Y count",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      },
      innerAnimSpeed: {
        label: "Inner anim speed",
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
      waveAmplitude: {
        label: "Wave amplitude",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      waveMultiplier: {
        label: "Wave multiplier",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.1
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
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
