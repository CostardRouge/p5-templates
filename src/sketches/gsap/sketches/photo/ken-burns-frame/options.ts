import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  imageIndex: 0,
  margin: 64,
  zoom: 0.12,
  panX: 0.06,
  panY: -0.04,
  caption: "",
  captionPosition: "bottom-left",
  captionColor: [
    255,
    255,
    255
  ],
  captionSize: 36
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  imageIndex: {
    component: "slider",
    label: "Image index",
    min: 0,
    max: 50,
    step: 1
  },
  margin: {
    component: "slider",
    label: "Frame margin",
    min: 0,
    max: 320,
    step: 1
  },
  zoom: {
    component: "slider",
    label: "Zoom",
    min: 0,
    max: 0.6,
    step: 0.01
  },
  panX: {
    component: "slider",
    label: "Pan X",
    min: -0.3,
    max: 0.3,
    step: 0.01
  },
  panY: {
    component: "slider",
    label: "Pan Y",
    min: -0.3,
    max: 0.3,
    step: 0.01
  },
  caption: {
    component: "text",
    label: "Caption"
  },
  captionPosition: {
    component: "select",
    label: "Caption position",
    options: [
      {
        label: "Top left",
        value: "top-left"
      },
      {
        label: "Top right",
        value: "top-right"
      },
      {
        label: "Middle center",
        value: "middle-center"
      },
      {
        label: "Bottom left",
        value: "bottom-left"
      },
      {
        label: "Bottom right",
        value: "bottom-right"
      }
    ]
  },
  captionColor: {
    component: "color",
    label: "Caption color"
  },
  captionSize: {
    component: "slider",
    label: "Caption size",
    min: 12,
    max: 120,
    step: 1
  }
};
