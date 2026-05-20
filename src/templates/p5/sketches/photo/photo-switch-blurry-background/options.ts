import getTestImagePaths from "@/utils/getTestImagePaths";

export const formValues = {
  images: await getTestImagePaths(),

  colors: {
    background: [
      246,
      235,
      225
    ],
    text: [
      0
    ]
  }
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images"
  },
  colors: {
    label: "Colors",
    component: "nested-object",
    fields: {
      background: {
        component: "color",
        label: "Background color"
      },
      text: {
        component: "color",
        label: "Text color"
      }
    }
  }
};
