import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

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
  ] as [number, number, number],
  textColor: [
    0
  ] as [number],

  // Title
  font: "martian",
  title: "variable-gravity-test",
  showTitle: true,
  titleSize: 172,
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
  },

  // Title
  font: {
    component: "select",
    label: "Font name",
    options: fontNames.map( fontName => ( {
      value: fontName,
      label: fontName
    } ) ),
  },
  title: {
    component: "text",
    label: "Custom title (empty → default)"
  },
  showTitle: {
    component: "checkbox",
    label: "Show title"
  },
  titleSize: {
    component: "slider",
    label: "Title size",
    min: 12,
    max: 400,
    step: 1
  },
};


