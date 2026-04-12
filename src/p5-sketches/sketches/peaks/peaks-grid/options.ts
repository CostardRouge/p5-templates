import easing from "@/p5/utils/easing";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  peaks: {
    depthLayersCount: 150,
    depthLengthMultiplier: 1,
    depthEasing: "easeOutQuad",
    noiseSeed: 488,
    point: {
      strokeWeightMax: 1,
      strokeWeightMin: 150,
      strokeWeightEasing: "linear",
    },
  },
  grid: {
    proportional: true,
    columns: 8,
    rows: 13,
  },
  backgroundColor: [
    0,
    0,
    0
  ],
  rotation: {
    enabled: true,
    angleMax: Math.PI / 16,
    xMultiplier: 2,
    yMultiplier: 3,
    zMultiplier: 0,
  },
  title: {
    ...titleDefaultValues,
    show: false
  },
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  peaks: {
    component: "nested-object",
    label: "Peaks",
    fields: {
      depthLayersCount: {
        label: "Depth layers count",
        component: "slider",
        min: 1,
        max: 1000,
        step: 1,
      },
      depthLengthMultiplier: {
        label: "Depth length",
        component: "slider",
        min: -10,
        max: 10,
        step: 0.01,
      },
      noiseSeed: {
        label: "Noise seed",
        component: "slider",
        min: 0,
        max: 9999,
        step: 1,
      },
      depthEasing: {
        component: "select",
        label: "Depth easing function",
        options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
          label: easingFunctionName,
          value: easingFunctionName,
        } ) ),
      },
      point: {
        component: "nested-object",
        label: "Point settings",
        fields: {
          strokeWeightMax: {
            label: "Start stroke weight",
            component: "slider",
            min: 1,
            max: 350,
            step: 1,
          },
          strokeWeightMin: {
            label: "End stroke weight",
            component: "slider",
            min: 1,
            max: 350,
            step: 1,
          },
          strokeWeightEasing: {
            component: "select",
            label: "Stroke weight easing function",
            options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
              label: easingFunctionName,
              value: easingFunctionName,
            } ) ),
          },
        },
      },
    },
  },
  grid: {
    component: "nested-object",
    label: "Grid settings",
    fields: {
      proportional: {
        label: "Proportional?",
        component: "checkbox",
      },
      columns: {
        label: "Column",
        component: "slider",
        min: 1,
        max: 30,
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 50,
      },
    }
  },
  
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      enabled: {
        label: "Enabled?",
        component: "checkbox",
      },
      angleMax: {
        label: "Angle max",
        component: "slider",
        min: 0,
        max: Math.PI,
        step: 0.01,
      },
      xMultiplier: {
        label: "X angle multiplier",
        component: "slider",
        min: -9,
        max: 9,
      },
      yMultiplier: {
        label: "Y angle multiplier",
        component: "slider",
        min: -9,
        max: 9,
      },
      zMultiplier: {
        label: "Z angle multiplier",
        component: "slider",
        min: -9,
        max: 9,
      },
    },
  },
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
};
