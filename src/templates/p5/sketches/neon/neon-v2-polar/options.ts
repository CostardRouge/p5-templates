import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3.5,
    axis: "vertical" as "vertical" | "horizontal" | "diagonal"
  },
  spiral: {
    shadowsCount: 3,
    weightMin: 75,
    weightMax: 200,
    opacityMin: 1,
    opacityMax: 6,
    angleStepsMin: 64,
    angleStepsMax: 200
  },
  motion: {
    timeSpeed: 1
  },
  colors: {
    hueSpeed: 1,
    useCached: true
  },
  backgroundColor: [
    0,
    0,
    0
  ] as number[],
  title: {
    ...titleDefaultValues,
    show: false
  }
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
        max: 30,
        step: 1
      },
      weightMin: {
        label: "Stroke weight min",
        component: "slider",
        min: 1,
        max: 300,
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
      angleStepsMin: {
        label: "Angle steps min",
        component: "slider",
        min: 8,
        max: 300,
        step: 1
      },
      angleStepsMax: {
        label: "Angle steps max",
        component: "slider",
        min: 8,
        max: 600,
        step: 1
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
      },
      useCached: {
        label: "Use cached colors (faster)",
        component: "checkbox"
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
