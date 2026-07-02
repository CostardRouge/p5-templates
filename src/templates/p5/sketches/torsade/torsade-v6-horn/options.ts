import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  layout: {
    xCount: 6,
    yCount: 1,
    sizeDivisor: 3.5
  },
  horn: {
    yShiftRatio: 0.5,
    angleScale: 10,
    waveMultMin: 3,
    waveMultMax: 8,
    waveAmpMin: 0,
    lerpSteps: 190,
    circleSizeStart: 200,
    circleSizeEnd: 50
  },
  motion: {
    timeSpeed: 1,
    indexScale: 5,
    cadenceMin: -4,
    cadenceMax: 4,
    timeWobbleEnabled: true
  },
  colors: {
    cadenceContribution: 1
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
      }
    }
  },
  horn: {
    component: "nested-object",
    label: "Horn",
    fields: {
      yShiftRatio: {
        label: "Y shift (× width)",
        component: "slider",
        min: -1,
        max: 1,
        step: 0.01
      },
      angleScale: {
        label: "Angle scale",
        component: "slider",
        min: 0.1,
        max: 30,
        step: 0.1
      },
      waveMultMin: {
        label: "Wave mult min",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      waveMultMax: {
        label: "Wave mult max",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.1
      },
      waveAmpMin: {
        label: "Wave amp min",
        component: "slider",
        min: 0,
        max: 500,
        step: 1
      },
      lerpSteps: {
        label: "Lerp steps",
        component: "slider",
        min: 20,
        max: 2000,
        step: 1
      },
      circleSizeStart: {
        label: "Circle size start",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      },
      circleSizeEnd: {
        label: "Circle size end",
        component: "slider",
        min: 1,
        max: 500,
        step: 1
      }
    }
  },
  motion: {
    component: "nested-object",
    label: "Motion",
    fields: {
      timeSpeed: {
        label: "Time speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.01
      },
      indexScale: {
        label: "Index scale",
        component: "slider",
        min: 0.1,
        max: 30,
        step: 0.1
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
      },
      timeWobbleEnabled: {
        label: "Time wobble",
        component: "checkbox"
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Colors",
    fields: {
      cadenceContribution: {
        label: "Cadence contribution",
        component: "slider",
        min: 0,
        max: 5,
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
