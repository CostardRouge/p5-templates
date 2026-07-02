import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  layoutFormConfiguration
} from "../_form";

export const formValues = {
  layout: {
    xCount: 7,
    yCount: 1,
    sizeDivisor: 1.5
  },
  line: {
    shadowsCount: 50,
    shadowIndexStep: 0.1,
    weightStart: 150,
    weightEnd: 20,
    widthMin: -0.333,
    widthMax: 5,
    sizeDivisorNear: 10,
    sizeDivisorFar: 1,
    heightFactor: 2,
    yAnchorOffset: -15,
    weightPulseSpeed: 1,
    weightPulseShadowDivisor: 3
  },
  motion: {
    driftSpeed: 1.5,
    driftIndexDivisor: 10,
    driftShadowDivisor: 5,
    driftIndexPhase: 4
  },
  colors: {
    hueSpeed: 1,
    opacityPulseSpeed: 3,
    opacityPulseMin: 1,
    opacityPulseMax: 15,
    opacityFalloffMin: 1,
    opacityFalloffMax: 5
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
  line: {
    component: "nested-object",
    label: "Line",
    fields: {
      shadowsCount: {
        label: "Shadows count",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      shadowIndexStep: {
        label: "Shadow step",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01
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
      widthMin: {
        label: "Width min",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.01
      },
      widthMax: {
        label: "Width max",
        component: "slider",
        min: -10,
        max: 20,
        step: 0.01
      },
      sizeDivisorNear: {
        label: "Size divisor near",
        component: "slider",
        min: 0.1,
        max: 50,
        step: 0.1
      },
      sizeDivisorFar: {
        label: "Size divisor far",
        component: "slider",
        min: 0.1,
        max: 50,
        step: 0.1
      },
      heightFactor: {
        label: "Height factor",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      yAnchorOffset: {
        label: "Y anchor offset",
        component: "slider",
        min: -500,
        max: 500,
        step: 1
      },
      weightPulseSpeed: {
        label: "Weight pulse speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      weightPulseShadowDivisor: {
        label: "Weight pulse shadow divisor",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      driftSpeed: {
        label: "Drift speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.01
      },
      driftIndexDivisor: {
        label: "Drift index divisor",
        component: "slider",
        min: 0.1,
        max: 50,
        step: 0.1
      },
      driftShadowDivisor: {
        label: "Drift shadow divisor",
        component: "slider",
        min: 0.1,
        max: 50,
        step: 0.1
      },
      driftIndexPhase: {
        label: "Drift index phase",
        component: "slider",
        min: 0.1,
        max: 50,
        step: 0.1
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
        step: 0.01
      },
      opacityPulseSpeed: {
        label: "Opacity pulse speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      opacityPulseMin: {
        label: "Opacity pulse min",
        component: "slider",
        min: 0.1,
        max: 50,
        step: 0.1
      },
      opacityPulseMax: {
        label: "Opacity pulse max",
        component: "slider",
        min: 0.1,
        max: 100,
        step: 0.1
      },
      opacityFalloffMin: {
        label: "Opacity falloff min",
        component: "slider",
        min: 0.1,
        max: 50,
        step: 0.1
      },
      opacityFalloffMax: {
        label: "Opacity falloff max",
        component: "slider",
        min: 0.1,
        max: 50,
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
