import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import getTestImagePaths from "@/utils/getTestImagePaths";

// Default values only
export const formValues = {
  // Assets
  images: await getTestImagePaths(),

  // Colors
  backgroundColor: [
    246,
    235,
    225
  ],

  // Grid
  rows: 4,
  columns: 3,
  blur: 9,

  title: titleDefaultValues
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  // Assets
  images: {
    component: "images-stack",
    label: "Images"
  },

  // Grid
  rows: {
    component: "slider",
    label: "Rows",
    min: 1,
    max: 12,
    step: 1
  },
  columns: {
    component: "slider",
    label: "Columns",
    min: 1,
    max: 12,
    step: 1
  },
  blur: {
    component: "slider",
    label: "Background blur",
    min: 0,
    max: 40,
    step: 1
  },

  posterize: {
    component: "slider",
    label: "Background posterize",
    min: 0,
    max: 40,
    step: 1
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  title: titleFormConfiguration
};
