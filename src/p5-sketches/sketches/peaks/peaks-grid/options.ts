import easing from "@/p5/utils/easing";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  peaks: {
    depthLayersCount: 150,
    depthLength: -0.15,
    point: {
      strokeWeightMax: 1,
      strokeWeightMin: 150,
      strokeWeightEasing: "easeOutCirc",
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
      depthLength: {
        label: "Depth length",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.01,
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
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
  title: titleFormConfiguration,
};
