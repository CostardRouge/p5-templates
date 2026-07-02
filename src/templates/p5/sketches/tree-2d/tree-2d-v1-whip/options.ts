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
    marginTop: 50,
    marginBottom: 250
  },
  branches: {
    count: 3,
    timeSign: 1,
    phaseDivider: 40
  },
  waves: {
    strengthEasing: "easeInSine",
    countEasing: "easeOutQuart",
    countMax: 2,
    amplitudeXDivider: 3,
    amplitudeYDivider: 9
  },
  lines: {
    countMin: 1,
    countMax: 3,
    length: 75,
    weightMin: 10,
    weightMax: 30,
    lengthEasing: "easeInQuad",
    countEasing: "easeInOutQuad",
    weightEasing: "easeInOutQuad"
  },
  rotation: {
    speed: 2,
    count: 1,
    stepDivider: 30
  },
  opacity: {
    startFactor: 3,
    endFactor: 1,
    speed: 3,
    groupCount: 3,
    pingPong: false
  },
  colors: {
    palette: "rainbow",
    hueIndexMultiplier: 12,
    hueIndexEasing: "linear",
    hueOffsetTimeMix: 1,
    hueOffsetBranchMix: 1
  },
  grid: {
    show: true,
    columns: 3,
    rows: 3,
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
      },
      timeSign: {
        label: "Time direction (+1 / -1)",
        component: "slider",
        min: -1,
        max: 1,
        step: 2
      },
      phaseDivider: {
        label: "Phase divider (i / N)",
        component: "slider",
        min: 1,
        max: 400,
        step: 1
      }
    }
  },
  waves: {
    component: "nested-object",
    label: "Waves",
    fields: {
      strengthEasing: {
        component: "easing",
        label: "Strength easing"
      },
      countEasing: {
        component: "easing",
        label: "Count easing"
      },
      countMax: {
        label: "Count max",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
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
      countMin: {
        label: "Count min",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
      },
      countMax: {
        label: "Count max",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
      },
      length: {
        label: "Length",
        component: "slider",
        min: 1,
        max: 400,
        step: 1
      },
      weightMin: {
        label: "Weight min",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.5
      },
      weightMax: {
        label: "Weight max",
        component: "slider",
        min: 0,
        max: 200,
        step: 0.5
      },
      lengthEasing: {
        component: "easing",
        label: "Length easing"
      },
      countEasing: {
        component: "easing",
        label: "Count easing"
      },
      weightEasing: {
        component: "easing",
        label: "Weight easing"
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
      },
      hueOffsetBranchMix: {
        label: "Hue offset · branch mix",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01
      }
    }
  },
  grid: {
    component: "nested-object",
    label: "Background grid",
    fields: {
      show: {
        label: "Show grid",
        component: "checkbox"
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      },
      rows: {
        label: "Rows",
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
