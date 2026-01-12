import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

// Default values only
export const formValues = {
  // Assets
  images: [
  ],

  imageStyle: {
    fill: true,
    clip: true,
    center: true,
    scale: 1,
    margin: 0,
  },

  // Colors
  backgroundColor: [
    246,
    235,
    225
  ],

  // Grid
  rows: 4,
  columns: 3,

  title: {
    ...titleDefaultValues,
  },
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  // Assets
  images: {
    component: "images-stack",
    label: "Images",
  },

  // Grid
  rows: {
    component: "slider",
    label: "Rows",
    min: 1,
    max: 12,
    step: 1,
  },
  columns: {
    component: "slider",
    label: "Columns",
    min: 1,
    max: 12,
    step: 1,
  },

  imageStyle: {
    label: "Image style",
    component: "nested-object",
    fields: {
      margin: {
        label: "Image margin",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.005,
      },
      scale: {
        label: "Scale",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1,
      },
      center: {
        label: "Center image",
        component: "checkbox",
      },
      clip: {
        label: "Clip",
        component: "checkbox",
      },
      fill: {
        label: "Fill",
        component: "checkbox",
      },
    }
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color",
  },

  title: {
    ...titleFormConfiguration,
  },
};
