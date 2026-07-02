import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

const AXIS_OPTIONS = [
  {
    label: "Vertical",
    value: "vertical"
  },
  {
    label: "Horizontal",
    value: "horizontal"
  }
];

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3.5,
    axis: "vertical"
  },
  spiral: {
    lerpSteps: 200,
    waveAmplitudeDivisor: 3.5,
    circleSize: 200,
    cadenceMin: -4,
    cadenceMax: 4
  },
  motion: {
    cadenceSpeed: 1,
    cadenceIndexScale: 0
  },
  colors: {
    hueSpeed: 1,
    hueSpread: 1,
    huePhase: 0,
    indexHueShift: 1,
    shimmer: 1.5,
    saturation: 1,
    brightness: 1
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

// UI configuration only
export const formConfiguration: Record<string, any> = {
  layout: {
    component: "nested-object",
    label: "Layout",
    fields: {
      xCount: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      yCount: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      sizeDivisor: {
        label: "Cell size divisor",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.1
      },
      axis: {
        label: "Spiral axis",
        component: "select",
        options: AXIS_OPTIONS
      }
    }
  },
  spiral: {
    component: "nested-object",
    label: "Spiral",
    fields: {
      lerpSteps: {
        label: "Samples",
        component: "slider",
        min: 1,
        max: 320,
        step: 1
      },
      waveAmplitudeDivisor: {
        label: "Wave amplitude divisor",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      },
      circleSize: {
        label: "Disc size",
        component: "slider",
        min: 10,
        max: 600,
        step: 1
      },
      cadenceMin: {
        label: "Cadence min",
        component: "slider",
        min: -20,
        max: 0,
        step: 0.1
      },
      cadenceMax: {
        label: "Cadence max",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      cadenceSpeed: {
        label: "Cadence speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      cadenceIndexScale: {
        label: "Cadence index scale",
        component: "slider",
        min: 0,
        max: 5,
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
        min: 0,
        max: 10,
        step: 0.1
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      huePhase: {
        label: "Hue phase",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      indexHueShift: {
        label: "Index hue shift",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      shimmer: {
        label: "Shimmer",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      saturation: {
        label: "Saturation",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
