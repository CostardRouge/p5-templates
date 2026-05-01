import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

// Default values only
export const formValues = {
  // Assets
  images: [
  ],

  // Colors (sketch-level overrides; falls back to global options.colors if unset)
  backgroundColor: [
    0,
    0,
    0
  ],
  textColor: [
    128,
    128,
    255
  ],

  title: titleDefaultValues,

  // Behavior
  rotateX: false,
  rotateZ: false,
  variableBackgroundColor: false,
  variableZoom: false,
  zoom: -2000,
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

  // Behavior
  rotateX: {
    component: "checkbox",
    label: "Rotate X",
  },
  rotateZ: {
    component: "checkbox",
    label: "Rotate Z",
  },
  variableBackgroundColor: {
    component: "checkbox",
    label: "Animated background color",
  },
  variableZoom: {
    component: "checkbox",
    label: "Animated zoom",
  },
  zoom: {
    component: "slider",
    label: "Zoom (Z translate)",
    min: -10000,
    max: 1000,
    step: 10,
  },

  title: titleFormConfiguration,
};
