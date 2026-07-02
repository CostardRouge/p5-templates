import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3.5,
    yOffset: 0
  },
  spiral: {
    shadowsCount: 10,
    weightStart: 1000,
    weightEnd: 75,
    opacityStart: 7,
    opacityEnd: 1,
    shadowOffsetDeg: 7
  },
  motion: {
    divisorMin: 1,
    divisorMax: 9,
    divisorTimeScale: 0.25,
    orbitTimeScale: 1,
    lineTwistScale: 1
  },
  colors: {
    hueScale: 360,
    greenScale: 255,
    blueScale: 255
  },
  background: {
    color: [
      0,
      0,
      0
    ] as number[]
  },
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
      yOffset: {
        label: "Y offset",
        component: "slider",
        min: -500,
        max: 500,
        step: 1
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
        min: 1,
        max: 80,
        step: 1
      },
      weightStart: {
        label: "Weight start",
        component: "slider",
        min: 1,
        max: 2000,
        step: 1
      },
      weightEnd: {
        label: "Weight end",
        component: "slider",
        min: 1,
        max: 2000,
        step: 1
      },
      opacityStart: {
        label: "Opacity divider start",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      },
      opacityEnd: {
        label: "Opacity divider end",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      },
      shadowOffsetDeg: {
        label: "Shadow offset (deg)",
        component: "slider",
        min: 0,
        max: 90,
        step: 0.1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      divisorMin: {
        label: "Divisor min",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      },
      divisorMax: {
        label: "Divisor max",
        component: "slider",
        min: 0.1,
        max: 40,
        step: 0.1
      },
      divisorTimeScale: {
        label: "Divisor time scale (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      orbitTimeScale: {
        label: "Orbit time scale (snaps to whole turns/loop)",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      lineTwistScale: {
        label: "Line twist scale (snaps to whole cycles/loop)",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      hueScale: {
        label: "Red channel scale",
        component: "slider",
        min: 0,
        max: 720,
        step: 1
      },
      greenScale: {
        label: "Green channel scale",
        component: "slider",
        min: 0,
        max: 720,
        step: 1
      },
      blueScale: {
        label: "Blue channel scale",
        component: "slider",
        min: 0,
        max: 720,
        step: 1
      }
    }
  },
  background: {
    component: "nested-object",
    label: "Background",
    fields: {
      color: {
        component: "color",
        label: "Background color"
      }
    }
  },
  title: titleFormConfiguration
};
