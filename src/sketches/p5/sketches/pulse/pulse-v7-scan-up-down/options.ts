import {
  layoutFormConfiguration
} from "../_form";

export const formValues = {
  layout: {
    xCount: 1,
    yCount: 1,
    sizeDivisor: 3
  },
  spiral: {
    shadowsCount: 5,
    shadowIndexStep: 0.02,
    weightStart: 200,
    weightEnd: 20,
    opacityStart: 5,
    opacityEnd: 1,
    sizeMinFactor: 0.5,
    sizeMaxFactor: 1,
    angleSubdivisions: 7
  },
  motion: {
    drift: 0.6,
    xSpeed: 1,
    ySpeed: 3,
    yDriftMult: 3,
    offsetMultMax: 5,
    offsetMultSpeed: 0.5,
    angleDriftSpeed: 0.2
  },
  colors: {
    hueSpeed: 1,
    opacityPulseSpeed: 3,
    opacityPulseMaxFactor: 10
  },
  background: {
    color: [
      0,
      0,
      0,
      255
    ] as number[]
  }
};

export const formConfiguration: Record<string, any> = {
  layout: layoutFormConfiguration,
  spiral: {
    component: "nested-object",
    label: "Spiral",
    fields: {
      shadowsCount: {
        label: "Shadows count",
        component: "slider",
        min: 1,
        max: 50,
        step: 1
      },
      shadowIndexStep: {
        label: "Shadow step",
        component: "slider",
        min: 0.001,
        max: 0.5,
        step: 0.001
      },
      weightStart: {
        label: "Weight start",
        component: "slider",
        min: 1,
        max: 600,
        step: 1
      },
      weightEnd: {
        label: "Weight end",
        component: "slider",
        min: 1,
        max: 600,
        step: 1
      },
      opacityStart: {
        label: "Opacity start",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.1
      },
      opacityEnd: {
        label: "Opacity end",
        component: "slider",
        min: 1,
        max: 50,
        step: 0.1
      },
      sizeMinFactor: {
        label: "Size min factor",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      sizeMaxFactor: {
        label: "Size max factor",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      angleSubdivisions: {
        label: "Angle subdivisions",
        component: "slider",
        min: 1,
        max: 32,
        step: 1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      drift: {
        label: "Drift",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      xSpeed: {
        label: "X speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      ySpeed: {
        label: "Y speed",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.1
      },
      yDriftMult: {
        label: "Y drift mult",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      offsetMultMax: {
        label: "Shadow offset max",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.1
      },
      offsetMultSpeed: {
        label: "Offset speed",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      angleDriftSpeed: {
        label: "Angle drift speed",
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
      opacityPulseSpeed: {
        label: "Opacity pulse speed",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      opacityPulseMaxFactor: {
        label: "Opacity pulse max factor",
        component: "slider",
        min: 1,
        max: 100,
        step: 0.5
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
  }
};
