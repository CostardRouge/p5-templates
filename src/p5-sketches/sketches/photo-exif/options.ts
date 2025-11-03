import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  margin: 0.1,
  font: "martian",
  fontSize: 20,
  fontStroke: [
    255,
    255,
    255
  ],
  fontColor: [
    0,
    0,
    0
  ],
  photo: null,
  topLeft: "",
  topRight: "",
  bottomLeft: "",
  bottomRight: ""
};

export const formConfiguration: Record<string, any> = {
  margin: {
    label: "Image margin",
    component: "slider",
    min: 0,
    max: 0.45,
    step: 0.005
  },
  fontSize: {
    component: "slider",
    label: "Font size",
    min: 1,
    max: 244
  },
  font: {
    component: "select",
    label: "Font name",
    options: fontNames.map( fontName => ( {
      value: fontName,
      label: fontName
    } ) ),
  },
  fontColor: {
    component: "color",
    label: "Font color"
  },
  fontStroke: {
    component: "color",
    label: "Font stroke"
  },
  photo: {
    component: "image",
    label: "Image"
  },
  topLeft: {
    component: "text",
    label: "Top left",
  },
  topRight: {
    component: "text",
    label: "Top right",
  },
  bottomLeft: {
    component: "text",
    label: "Bottom left",
  },
  bottomRight: {
    component: "text",
    label: "Bottom right",
  },
};
