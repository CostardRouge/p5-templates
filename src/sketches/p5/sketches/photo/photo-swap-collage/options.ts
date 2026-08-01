import getTestImagePaths from "@/utils/getTestImagePaths";

// Default values only
export const formValues = {
  // Assets
  images: await getTestImagePaths(),

  background: {
    zoom: 1.8,
    zoomAmplitude: 0.08
  },

  inner: {
    width: 0.68,
    aspect: 1.3,
    verticalOffset: 0
  },

  // Colors
  backgroundColor: [
    246,
    235,
    225
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  // Assets
  images: {
    component: "images-stack",
    label: "Images"
  },

  background: {
    component: "nested-object",
    label: "Background halves",
    fields: {
      zoom: {
        label: "Zoom",
        component: "slider",
        min: 1,
        max: 4,
        step: 0.05
      },
      zoomAmplitude: {
        label: "Zoom animation amplitude",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      }
    }
  },

  inner: {
    component: "nested-object",
    label: "Inner collage",
    fields: {
      width: {
        label: "Width",
        component: "slider",
        min: 0.2,
        max: 0.95,
        step: 0.01
      },
      aspect: {
        label: "Aspect ratio",
        component: "slider",
        min: 0.5,
        max: 2,
        step: 0.05
      },
      verticalOffset: {
        label: "Vertical offset",
        component: "slider",
        min: -0.4,
        max: 0.4,
        step: 0.01
      }
    }
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
