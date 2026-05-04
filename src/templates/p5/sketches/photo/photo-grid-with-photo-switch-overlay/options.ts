import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import getTestImagePaths from "@/utils/getTestImagePaths";

export const formValues = {
  images: await getTestImagePaths(),

  grid: {
    borderSize: 0,
    rows: 3,
    columns: 3
  },

  backgroundColor: [
    246,
    235,
    225
  ],

  title: titleDefaultValues
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images"
  },

  grid: {
    component: "nested-object",
    label: "Grid settings",
    fields: {
      borderSize: {
        label: "Border size",
        component: "slider",
        min: 0,
        max: 100
      },
      rows: {
        label: "Rows",
        component: "slider",
        min: 1,
        max: 100
      },
      columns: {
        label: "Columns",
        component: "slider",
        min: 1,
        max: 100
      }
    }
  },

  title: titleFormConfiguration,

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
