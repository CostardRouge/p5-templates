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

const LINES_COUNT_SOURCES = [
  {
    label: "Beat (sin pulse)",
    value: "beat"
  },
  {
    label: "Fixed",
    value: "fixed"
  }
];

export const formValues = {
  steps: 400,
  path: {
    marginTop: 150,
    marginBottom: 150
  },
  beat: {
    min: 3,
    max: 6,
    timeSign: 1,
    easing: "easeInQuad"
  },
  branches: {
    base: 3,
    easing: "easeInSine"
  },
  waves: {
    amplitudeXDivider: 3,
    amplitudeYDivider: 6
  },
  lines: {
    length: 60,
    weight: 20,
    countSource: "beat",
    fixedCount: 4
  },
  rotation: {
    speed: 2,
    count: 1,
    stepDivider: 60
  },
  opacity: {
    startFactor: 3,
    endFactor: 1.3,
    speed: 3,
    groupCount: 3,
    pingPong: false
  },
  colors: {
    palette: "test",
    hueIndexMultiplier: 1,
    hueIndexEasing: "easeInOutSine",
    hueOffsetTimeMix: 1
  },
  grid: {
    show: true,
    columns: 0,
    weight: 2,
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
  beat: {
    component: "nested-object",
    label: "Beat (animated counts)",
    fields: {
      min: {
        label: "Min",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      },
      max: {
        label: "Max",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      },
      timeSign: {
        label: "Time direction (-1/+1)",
        component: "slider",
        min: -1,
        max: 1,
        step: 2
      },
      easing: {
        component: "easing",
        label: "Beat easing"
      }
    }
  },
  branches: {
    component: "nested-object",
    label: "Branches",
    fields: {
      base: {
        label: "Branch base count",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      },
      easing: {
        component: "easing",
        label: "Branch count easing"
      }
    }
  },
  waves: {
    component: "nested-object",
    label: "Waves",
    fields: {
      amplitudeXDivider: {
        label: "Amp X (width / N)",
        component: "slider",
        min: 1,
        max: 20,
        step: 0.1
      },
      amplitudeYDivider: {
        label: "Amp Y (width / N)",
        component: "slider",
        min: 1,
        max: 40,
        step: 0.1
      }
    }
  },
  lines: {
    component: "nested-object",
    label: "Lines",
    fields: {
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
      countSource: {
        label: "Lines count source",
        component: "select",
        options: LINES_COUNT_SOURCES
      },
      fixedCount: {
        label: "Fixed count (when source = fixed)",
        component: "slider",
        min: 1,
        max: 16,
        step: 0.1
      }
    }
  },
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      speed: {
        label: "Speed (snaps to whole turns/loop)",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      count: {
        label: "Count",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      },
      stepDivider: {
        label: "Step divider",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
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
    label: "Background grid (rows pulse with beat)",
    fields: {
      show: {
        label: "Show grid",
        component: "checkbox"
      },
      columns: {
        label: "Columns (0 = none)",
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
