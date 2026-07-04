import getTestImagePaths from "@/utils/getTestImagePaths";

const testImagePaths = await getTestImagePaths();

export const formValues = {
  // One entry per photo: the image plus the point (UV, 0–1) it zooms into.
  // Photos are shown one after another, each getting its own zoom in/out.
  items: [
    {
      photo: "/assets/images/test/DSC02023%20Medium.jpeg",
      point: {
        x: 0.9182064242978011,
        y: 0.40390829006230894
      }
    },
    {
      photo: "/assets/images/test/DSC02644%20Medium.jpeg",
      point: {
        x: 0.6311057817804419,
        y: 0.42686397666971193
      }
    },
    {
      photo: "/assets/images/test/DSC02930%20Medium.jpeg",
      point: {
        x: 0.4961392227346368,
        y: 0.39759251288904973
      }
    }
  ],

  zoom: {
    count: 1,
    easing: "easeInOutExpo",
    minZoomScale: 1,
    maxZoomScale: 5
  },

  circle: {
    draw: true,
    stroke: [
      255,
      255,
      255
    ],
    strokeWeight: 3,
    radius: 30
  },

  imageSettings: {
    margin: 0.1,
    scale: 1,
    center: true,
    clip: false,
    fill: false
  },

  backgroundColor: [
    246,
    235,
    225
  ]
};

export const formConfiguration: Record<string, any> = {
  items: {
    component: "item-list",
    label: "Photos",
    minItems: 1,
    itemConfig: {
      component: "nested-object",
      label: "Photo",
      initialExpanded: true,
      fields: {
        photo: {
          component: "image",
          label: "Photo"
        },
        point: {
          component: "vector2d",
          label: "Zoom point",
          allowNegative: false,
          min: 0,
          max: 1,
          step: 0.01,
          yDown: true
        }
      }
    }
  },

  zoom: {
    label: "Zoom",
    component: "nested-object",
    fields: {
      count: {
        label: "Zooms per photo",
        component: "slider",
        min: 0,
        max: 10
      },
      minZoomScale: {
        label: "Start scale",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      maxZoomScale: {
        label: "End scale",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      easing: {
        component: "easing",
        label: "Easing"
      }
    }
  },
  imageSettings: {
    label: "Image settings",
    component: "nested-object",
    fields: {
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
        label: "Center image",
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

  circle: {
    label: "Circle",
    component: "nested-object",
    fields: {
      draw: {
        label: "Draw circle?",
        component: "checkbox"
      },
      stroke: {
        label: "Stroke",
        component: "color"
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      radius: {
        label: "Radius",
        component: "slider",
        min: 0,
        max: 100
      }
    }
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
