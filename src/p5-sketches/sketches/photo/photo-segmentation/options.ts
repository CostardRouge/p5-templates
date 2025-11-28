import titleDefaultValues from "@/p5-sketches/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5-sketches/utils/title/titleFormConfiguration";

export const formValues = {
  photo: {
    image: null,
    margin: 0.1
  },
  title: titleDefaultValues,
  backgroundColor: [
    246,
    235,
    225
  ]
};

export const formConfiguration: Record<string, any> = {
  photo: {
    label: "Photo",
    component: "nested-object",
    fields: {
      image: {
        component: "image",
        label: "Image"
      },
      margin: {
        label: "Image margin",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.005
      },
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
