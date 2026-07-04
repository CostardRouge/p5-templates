
export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3.5,
    axis: "vertical" as "vertical" | "horizontal"
  },
  spiral: {
    lerpSteps: 300,
    waveAmplitudeDivisor: 2.5,
    angleScale: 1.5,
    circleSize: 100,
    cadenceMin: -4,
    cadenceMax: 4
  },
  motion: {
    cadenceSpeed: 1
  },
  colors: {
    hueSpeed: 1
  },
  backgroundColor: [
    0,
    0,
    0
  ]
};

export const formConfiguration: Record<string, any> = {
  layout: {
    component: "nested-object",
    label: "Layout",
    fields: {
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
      sizeDivisor: {
        label: "Size divisor",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.1
      },
      axis: {
        label: "Axis",
        component: "select",
        options: [
          {
            label: "Vertical",
            value: "vertical"
          },
          {
            label: "Horizontal",
            value: "horizontal"
          }
        ]
      }
    }
  },
  spiral: {
    component: "nested-object",
    label: "Spiral",
    fields: {
      lerpSteps: {
        label: "Lerp steps",
        component: "slider",
        min: 20,
        max: 2000,
        step: 1
      },
      waveAmplitudeDivisor: {
        label: "Wave amplitude divisor",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.1
      },
      angleScale: {
        label: "Angle scale",
        component: "slider",
        min: 0.1,
        max: 5,
        step: 0.01
      },
      circleSize: {
        label: "Circle size",
        component: "slider",
        min: 1,
        max: 500,
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
        label: "Cadence speed",
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
        label: "Hue speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
