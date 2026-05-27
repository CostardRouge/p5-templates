import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  shape: {
    quality: 1000
  },
  lines: {
    length: 40,
    weight: 80,
    maxCount: 1,
    growing: true,
    changeCount: false
  },
  opacity: {
    pingPong: true,
    speed: -2,
    groupCount: 2,
    startFactor: 3,
    endFactor: 1
  },
  rotation: {
    count: 1,
    speed: 2,
    indexMultiplier: 2
  },
  colors: {
    hueSpeed: 2
  },
  background: {
    gridCountA: 7,
    gridCountB: 6.6,
    weight: 3,
    tint: [
      128,
      128,
      255
    ] as number[],
    alpha: 255,
    animationSpeed: 0.25
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ] as number[],
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      quality: {
        component: "slider",
        label: "Quality (lerp steps)",
        min: 50,
        max: 2000,
        step: 1
      }
    }
  },
  lines: {
    component: "nested-object",
    label: "Lines",
    fields: {
      length: {
        component: "slider",
        label: "Lines length",
        min: 1,
        max: 200,
        step: 1
      },
      weight: {
        component: "slider",
        label: "Lines weight",
        min: 1,
        max: 300,
        step: 1
      },
      maxCount: {
        component: "slider",
        label: "Max lines count",
        min: 1,
        max: 10,
        step: 0.1
      },
      growing: {
        component: "checkbox",
        label: "Growing line"
      },
      changeCount: {
        component: "checkbox",
        label: "Change lines count over time"
      }
    }
  },
  opacity: {
    component: "nested-object",
    label: "Opacity",
    fields: {
      pingPong: {
        component: "checkbox",
        label: "Ping pong opacity"
      },
      speed: {
        component: "slider",
        label: "Speed",
        min: -10,
        max: 10,
        step: 0.1
      },
      groupCount: {
        component: "slider",
        label: "Group count",
        min: 1,
        max: 10,
        step: 0.1
      },
      startFactor: {
        component: "slider",
        label: "Start opacity factor",
        min: 1,
        max: 50,
        step: 0.1
      },
      endFactor: {
        component: "slider",
        label: "End opacity factor",
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
        component: "slider",
        label: "Rotation count",
        min: -5,
        max: 5,
        step: 0.01
      },
      speed: {
        component: "slider",
        label: "Rotation speed",
        min: -10,
        max: 10,
        step: 0.1
      },
      indexMultiplier: {
        component: "slider",
        label: "Index multiplier",
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
      hueSpeed: {
        component: "slider",
        label: "Hue speed",
        min: -10,
        max: 10,
        step: 0.1
      }
    }
  },
  background: {
    component: "nested-object",
    label: "Background grid",
    fields: {
      gridCountA: {
        component: "slider",
        label: "Grid count A (wobble)",
        min: 0,
        max: 20,
        step: 0.1
      },
      gridCountB: {
        component: "slider",
        label: "Grid count B (wobble)",
        min: 0,
        max: 20,
        step: 0.1
      },
      weight: {
        component: "slider",
        label: "Grid stroke weight",
        min: 1,
        max: 20,
        step: 1
      },
      tint: {
        component: "color",
        label: "Grid tint"
      },
      alpha: {
        component: "slider",
        label: "Grid alpha",
        min: 0,
        max: 255,
        step: 1
      },
      animationSpeed: {
        component: "slider",
        label: "Grid animation speed",
        min: -2,
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
