import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  photo: {
    image: null,
    margin: 0.1,
    scale: 1,
    center: true,
    clip: false,
    fill: false
  },
  segmentation: {
    roi: null, // { x: number, y: number } - normalized coordinates (0-1),
    inverse: true
  },
  title: {
    ...titleDefaultValues,
    blend: "source-over",
    fill: [
      255
    ],
    stroke: [
      0,
      0,
      0,
      0
    ],
    displayFrom: 0.0,
    displayTo: 1
  },
  backgroundColor: [
    246,
    235,
    225
  ]
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
      scale: {
        label: "Scale",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      center: {
        label: "Center",
        component: "checkbox"
      },
      clip: {
        label: "Clip",
        component: "checkbox"
      },
      fill: {
        label: "Fill",
        component: "checkbox"
      }
    }
  },
  segmentation: {
    label: "Segmentation",
    component: "nested-object",
    fields: {
      roi: {
        component: "hidden",
        label: "ROI (Region of Interest)"
      },
      inverse: {
        label: "Inverse mask",
        component: "checkbox"
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
