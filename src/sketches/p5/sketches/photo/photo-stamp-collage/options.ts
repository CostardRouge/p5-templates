import getTestImagePaths from "@/utils/getTestImagePaths";

// One entry per photo: the image, where its stamp sits on the paper, and which
// detail of it the stamp magnifies. Clicking the canvas writes both onto the
// photo that is on screen, so each photo keeps its own framing.
const items = ( await getTestImagePaths() ).map( ( photo ) => ( {
  photo,
  position: {
    x: 0.5,
    y: 0.27
  },
  focus: {
    x: 0.5,
    y: 0.5
  }
} ) );

// Default values only
export const formValues = {
  // Assets
  items,

  layout: {
    height: 0.52,
    align: "bottom",
    zoom: 1,
    zoomAmplitude: 0
  },

  stamp: {
    source: "same",
    cutout: true,
    size: 0.3,
    aspect: 1.2,
    zoom: 2.6,
    zoomAmplitude: 0,
    rotation: 0,
    border: 0,
    perforationSize: 0.13,
    perforationDepth: 0.4,
    shadow: 0.35,
    color: [
      255,
      255,
      255
    ]
  },

  paper: {
    grain: 0.35
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
        position: {
          component: "vector2d",
          label: "Stamp position (click the paper)",
          allowNegative: false,
          min: 0,
          max: 1,
          step: 0.01,
          yDown: true
        },
        focus: {
          component: "vector2d",
          label: "Stamp focus (click the photo)",
          allowNegative: false,
          min: 0,
          max: 1,
          step: 0.01,
          yDown: true
        }
      }
    }
  },

  layout: {
    component: "nested-object",
    label: "Big photo",
    fields: {
      height: {
        label: "Height",
        component: "slider",
        min: 0.1,
        max: 1,
        step: 0.01
      },
      align: {
        component: "select",
        label: "Anchor",
        options: [
          {
            label: "Bottom",
            value: "bottom"
          },
          {
            label: "Center",
            value: "center"
          },
          {
            label: "Top",
            value: "top"
          }
        ]
      },
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

  stamp: {
    component: "nested-object",
    label: "Stamp",
    fields: {
      source: {
        component: "select",
        label: "Content",
        options: [
          {
            label: "Detail of the big photo",
            value: "same"
          },
          {
            label: "Next image of the pair",
            value: "pair"
          }
        ]
      },
      cutout: {
        label: "Cut the zone out of the photo",
        component: "checkbox"
      },
      size: {
        label: "Size",
        component: "slider",
        min: 0.08,
        max: 0.8,
        step: 0.01
      },
      aspect: {
        label: "Aspect ratio",
        component: "slider",
        min: 0.5,
        max: 2,
        step: 0.05
      },
      zoom: {
        label: "Zoom",
        component: "slider",
        min: 1,
        max: 8,
        step: 0.05
      },
      zoomAmplitude: {
        label: "Zoom animation amplitude",
        component: "slider",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      rotation: {
        label: "Rotation (degrees)",
        component: "slider",
        min: -30,
        max: 30,
        step: 0.5
      },
      border: {
        label: "Paper margin",
        component: "slider",
        min: 0,
        max: 0.15,
        step: 0.005
      },
      perforationSize: {
        label: "Perforation size",
        component: "slider",
        min: 0.05,
        max: 0.3,
        step: 0.005
      },
      perforationDepth: {
        label: "Perforation depth",
        component: "slider",
        min: 0.1,
        max: 0.45,
        step: 0.01
      },
      shadow: {
        label: "Shadow",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      color: {
        component: "color",
        label: "Paper color"
      }
    }
  },

  paper: {
    component: "nested-object",
    label: "Paper",
    fields: {
      grain: {
        label: "Grain",
        component: "slider",
        min: 0,
        max: 1,
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
