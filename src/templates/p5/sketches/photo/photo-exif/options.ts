import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  photo: {
    image: null,
    margin: 0.1,
    backgroundColor: [
      246,
      235,
      225
    ]
  },
  topLeft: "",
  topRight: "",
  bottomLeft: "",
  bottomRight: "",
  font: {
    face: "martian",
    size: 20,
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
  photo: {
    label: "Photo",
    component: "nested-object",
    fields: {
      image: {
        component: "image",
        label: "Image"
      },
      margin: {
        label: "Image margin",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.005
      },
      backgroundColor: {
        component: "color",
        label: "Background color"
      }
    }
  },
  font: {
    label: "Font style",
    component: "nested-object",
    fields: {
      size: {
        component: "slider",
        label: "Font size",
        min: 1,
        max: 244
      },
      face: {
        component: "select",
        label: "Font name",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      color: {
        component: "color",
        label: "Font color"
      },
      stroke: {
        component: "color",
        label: "Font stroke"
      }
    }
  },
  textOverrides: {
    label: "Text overrides",
    component: "nested-object",
    fields: {
      topLeft: {
        component: "text",
        label: "Top left"
      },
      topRight: {
        component: "text",
        label: "Top right"
      },
      bottomLeft: {
        component: "text",
        label: "Bottom left"
      },
      bottomRight: {
        component: "text",
        label: "Bottom right"
      }
    }
  }
};
