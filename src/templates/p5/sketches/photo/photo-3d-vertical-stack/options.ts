import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

// Default values only
export const formValues = {
  // Assets
  images: [],

  // Colors
  backgroundColor: [
    230,
    230,
    230
  ],
  textColor: [
    0,
    0,
    0
  ],

  // Typography
  font: "cloitre",
  topText: "3d\nphoto",
  bottomText: "stack\nscroll",

  // Cards / motion
  count: 200,
  rotate: true,
  showExifBar: true
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

  // Typography
  font: {
    component: "select",
    label: "Font name",
    options: fontNames.map( ( fontName ) => ( {
      value: fontName,
      label: fontName
    } ) )
  },
  topText: {
    component: "text",
    label: "Top text"
  },
  bottomText: {
    component: "text",
    label: "Bottom text"
  },

  // Cards / motion
  count: {
    component: "slider",
    label: "Card count",
    min: 1,
    max: 500,
    step: 1
  },
  rotate: {
    component: "checkbox",
    label: "Rotate cards"
  },
  showExifBar: {
    component: "checkbox",
    label: "Show EXIF bar"
  }
};
