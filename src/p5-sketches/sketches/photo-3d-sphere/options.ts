import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

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
  ] as [number, number, number],
  textColor: [
    128,
    128,
    255
  ] as [number, number, number],

  // Typography / Title
  font: "martian",
  title: "photo-3d-sphere",
  showTitle: true,
  titleSize: 450,

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

  // Typography / Title
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
    max: 800,
    step: 1
  },

  // Behavior
  rotateX: {
    component: "checkbox",
    label: "Rotate X"
  },
  rotateZ: {
    component: "checkbox",
    label: "Rotate Z"
  },
  variableBackgroundColor: {
    component: "checkbox",
    label: "Animated background color"
  },
  variableZoom: {
    component: "checkbox",
    label: "Animated zoom"
  },
  zoom: {
    component: "slider",
    label: "Zoom (Z translate)",
    min: -10000,
    max: 1000,
    step: 10
  },
};


