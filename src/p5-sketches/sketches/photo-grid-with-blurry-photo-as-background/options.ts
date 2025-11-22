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

  // Grid
  rows: 4,
  columns: 3,
  blur: 9,

  // Title
  font: "martian",
  title: "",
  showTitle: true,
  titleSize: 128,
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

