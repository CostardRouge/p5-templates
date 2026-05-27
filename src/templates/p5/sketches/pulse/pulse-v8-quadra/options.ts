import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
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
    shadowsCount: 20,
    shadowIndexStep: 0.07,
    weightStart: 400,
    weightEnd: 20,
    opacityStart: 10,
    opacityEnd: 0.5,
    sizeMinFactor: 0.2,
    sizeMaxFactor: 1.2,
    angleSubdivisions: 4
  },
  motion: {
    shadowOffsetAmp: 50,
    angleDriftSpeed: 1
  },
  colors: {
    hueSpeed: 1,
    opacityPulseSpeed: 3,
    opacityPulseMaxFactor: 150,
    opacityDivisor: 2
  },
  background: {
    color: [
      0,
      0,
      0,
      255
    ] as number[]
  },
  title: {
    ...titleDefaultValues,
    show: false
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
        min: 0.1,
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
      shadowOffsetAmp: {
        label: "Shadow offset amp",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
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
        max: 300,
        step: 1
      },
      opacityDivisor: {
        label: "Opacity divisor",
        component: "slider",
        min: 0.5,
        max: 10,
        step: 0.1
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
