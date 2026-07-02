import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

const PALETTE_OPTIONS = [
  {
    label: "Rainbow",
    value: "rainbow"
  },
  {
    label: "Rainbow crazy",
    value: "rainbowCrazy"
  },
  {
    label: "Test (sin/cos channels)",
    value: "test"
  },
  {
    label: "Purple",
    value: "purple"
  },
  {
    label: "Dark blue / yellow",
    value: "darkBlueYellow"
  },
  {
    label: "Green",
    value: "green"
  },
  {
    label: "Black",
    value: "black"
  }
];

export const formValues = {
  steps: 400,
  path: {
    marginTop: 150,
    marginBottom: 150
  },
  branches: {
    count: 3
  },
  waves: {
    strengthEasing: "easeInOutQuad",
    amplitudeXDivider: 4,
    amplitudeYDivider: 8,
    xEasing: "easeInQuad",
    yEasing: "easeOutQuad"
  },
  lines: {
    countMin: 1,
    countMax: 4,
    length: 60,
    weight: 20,
    countEasing: "easeInOutQuad"
  },
  opacity: {
    startFactor: 3,
    endFactor: 1.3,
    speed: 3,
    groupCount: 3,
    pingPong: false
  },
  colors: {
    palette: "rainbow",
    hueIndexMultiplier: 16,
    hueIndexEasing: "easeInOutSine",
    hueOffsetTimeMix: 0
  },
  grid: {
    show: true,
    columns: 5,
    rows: 0,
    weight: 2,
    scrollSpeed: 1.5,
    palette: "purple"
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
  steps: {
    label: "Steps",
    component: "slider",
    min: 1,
    max: 1200,
    step: 1
  },
  path: {
    component: "nested-object",
    label: "Path",
    fields: {
      marginTop: {
        label: "Top margin",
        component: "slider",
        min: 0,
        max: 800,
        step: 1
      },
      marginBottom: {
        label: "Bottom margin",
        component: "slider",
        min: 0,
        max: 800,
        step: 1
      }
    }
  },
  branches: {
    component: "nested-object",
    label: "Branches",
    fields: {
      count: {
        label: "Branch count",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      }
    }
  },
  waves: {
    component: "nested-object",
    label: "Waves (asymmetric y)",
    fields: {
      strengthEasing: {
        component: "easing",
        label: "Strength easing"
      },
      amplitudeXDivider: {
        label: "Amp X (width / N)",
        component: "slider",
        min: 1,
        max: 20,
        step: 0.1
      },
      amplitudeYDivider: {
        label: "Amp Y up (width / N)",
        component: "slider",
        min: 1,
        max: 40,
        step: 0.1
      },
      xEasing: {
        component: "easing",
        label: "X easing"
      },
      yEasing: {
        component: "easing",
        label: "Y easing"
      }
    }
  },
  lines: {
    component: "nested-object",
    label: "Lines",
    fields: {
      countMin: {
        label: "Count min",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      },
      countMax: {
        label: "Count max",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      },
      length: {
        label: "Length",
        component: "slider",
        min: 1,
        max: 400,
        step: 1
      },
      weight: {
        label: "Weight",
        component: "slider",
        min: 1,
        max: 200,
        step: 0.5
      },
      countEasing: {
        component: "easing",
        label: "Count easing"
      }
    }
  },
  opacity: {
    component: "nested-object",
    label: "Opacity",
    fields: {
      startFactor: {
        label: "Start opacity (reduction factor)",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.1
      },
      endFactor: {
        label: "End opacity (reduction factor)",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.1
      },
      speed: {
        label: "Speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      groupCount: {
        label: "Group count",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
      },
      pingPong: {
        label: "Ping Pong opacity",
        component: "checkbox"
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      hueIndexMultiplier: {
        label: "Hue index multiplier",
        component: "slider",
        min: -32,
        max: 32,
        step: 0.1
      },
      hueIndexEasing: {
        component: "easing",
        label: "Hue index easing"
      },
      hueOffsetTimeMix: {
        label: "Hue offset · time mix (snaps to whole cycles/loop)",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01
      }
    }
  },
  grid: {
    component: "nested-object",
    label: "Walking grid (scrolling verticals)",
    fields: {
      show: {
        label: "Show grid",
        component: "checkbox"
      },
      columns: {
        label: "Vertical lines",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      },
      rows: {
        label: "Horizontal rows",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      },
      weight: {
        label: "Line weight",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.5
      },
      scrollSpeed: {
        label: "Scroll speed (px/frame)",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      palette: {
        label: "Grid palette",
        component: "select",
        options: PALETTE_OPTIONS
      }
    }
  },
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
