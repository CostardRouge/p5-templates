import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleFormConfiguration from "@/templates/p5/utils/title/titleFormConfiguration";
import titleDefaultValues from "@/templates/p5/utils/title/titleDefaultValues";

// Default values only
export const formValues = {
  // Assets
  images: [
  ],

  // Colors
  backgroundColor: [
    246,
    235,
    225
  ],
  textColor: [
    0
  ],

  title: titleDefaultValues,
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  // Assets
  images: {
    component: "images-stack",
    label: "Images",
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
  textColor: {
    component: "color",
    label: "Text color",
  },

  title: titleFormConfiguration
};
