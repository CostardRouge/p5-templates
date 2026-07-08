
export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3.5,
    axis: "vertical" as "vertical" | "horizontal" | "diagonal"
  },
  spiral: {
    shadowsCount: 3,
    weightMin: 100,
    weightMax: 250,
    opacityMin: 1,
    opacityMax: 10,
    lerpSteps: 200,
    angleNarrow: 0.6
  },
  motion: {
    timeSpeed: 1
  },
  colors: {
    hueSpeed: 1
  },
  backgroundColor: [
    0,
    0,
    0
  ] as number[]
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
        max: 10,
        step: 1
      },
      yCount: {
        label: "Y count",
        component: "slider",
        min: 1,
        max: 10,
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
          },
          {
            label: "Diagonal",
            value: "diagonal"
          }
        ]
      }
    }
  },
  spiral: {
    component: "nested-object",
    label: "Spiral",
    fields: {
      shadowsCount: {
        label: "Shadow layers",
        component: "slider",
        min: 0,
        max: 20,
        step: 1
      },
      weightMin: {
        label: "Stroke weight min",
        component: "slider",
        min: 1,
        max: 350,
        step: 1
      },
      weightMax: {
        label: "Stroke weight max",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      },
      opacityMin: {
        label: "Opacity min",
        component: "slider",
        min: 1,
        max: 10,
        step: 0.1
      },
      opacityMax: {
        label: "Opacity max",
        component: "slider",
        min: 1,
        max: 30,
        step: 0.1
      },
      lerpSteps: {
        label: "Lerp steps",
        component: "slider",
        min: 20,
        max: 1000,
        step: 1
      },
      angleNarrow: {
        label: "Angle narrowing",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.01
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      timeSpeed: {
        label: "Time speed",
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
        min: 0,
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
