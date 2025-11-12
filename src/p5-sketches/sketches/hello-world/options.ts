import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  text: "hello world",
  backgroundColor: [
    0,
    0,
    0
  ],
  font: {
    face: "martian",
    size: 200,
    color: [
      0,
      0,
      0
    ],
    stroke: [
      255,
      255,
      255
    ]
  }
};

export const formConfiguration: Record<string, any> = {
  text: {
    component: "text",
    label: "Text input"
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  font: {
    label: "Font style",
    component: "nested-object",
    fields: {
      size: {
        component: "slider",
        label: "Font size",
        min: 1,
        max: 512
      },
      face: {
        component: "select",
        label: "Font name",
        options: fontNames.map( fontName => ( {
          value: fontName,
          label: fontName
        } ) ),
      },
      color: {
        component: "color",
        label: "Font color"
      },
      stroke: {
        component: "color",
        label: "Font stroke"
      },
    }
  }
};
