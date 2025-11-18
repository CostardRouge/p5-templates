import titleDefaultValues from "@/p5-sketches/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5-sketches/utils/title/titleFormConfiguration";

export const formValues = {
  text: titleDefaultValues,
  backgroundColor: [
    0,
    0,
    0
  ]
};

export const formConfiguration: Record<string, any> = {
  text: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
};
