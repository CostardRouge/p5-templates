// Default values only

export const formValues = {
  images: [
  ],

  // dominantColorSample: 50,

  backgroundColor: [
    246,
    235,
    225
  ],

  grid: {
    borderSize: 0,
    rows: 3,
    columns: 3
  },

};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images",
  },

  // dominantColorSample: {
  //   component: "slider",
  //   label: "Dominant color sample size",
  //   min: 2,
  //   max: 200,
  //   step: 1,
  // },

  grid: {
    component: "nested-object",
    label: "Grid settings",
    fields: {
      borderSize: {
        label: "Border size",
        component: "slider",
        min: 0,
        max: 100,
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 100,
      },
      columns: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 100,
      },
    }
  },

  backgroundColor: {
    component: "color",
    label: "Background color",
  },
};
