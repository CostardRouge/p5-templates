import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
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
  textColor: [
    0
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  // Assets
  images: {
    component: "images-stack",
    label: "Images"
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  textColor: {
    component: "color",
    label: "Text color"
  }
};
