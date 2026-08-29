import getTestImagePaths from "@/utils/getTestImagePaths";

// One entry per photo: the image and where its swap zone sits. Photos are shown
// in pairs, and the pair's zone is the one carried by its first photo — that is
// the entry a click on the canvas writes to.
const items = ( await getTestImagePaths() ).map( ( photo ) => ( {
  photo,
  position: {
    x: 1,
    y: 0.5
  }
} ) );

// Default values only
export const formValues = {
  // Assets
  items,

  layout: {
    direction: "horizontal"
  },

  background: {
    zoom: 1,
    zoomAmplitude: 0
  },

  swapZone: {
    content: "crop",
    width: 0.34,
    height: 0.35,
    horizontalMirror: true,
    verticalMirror: true
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
    minItems: 2,
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
          label: "Swap zone (click the canvas)",
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
    label: "Layout",
    fields: {
      direction: {
        component: "select",
        label: "Collage direction",
        options: [
          {
            label: "Horizontal (side by side)",
            value: "horizontal"
          },
          {
            label: "Vertical (stacked)",
            value: "vertical"
          }
        ]
      }
    }
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

  swapZone: {
    component: "nested-object",
    label: "Swap zone",
    fields: {
      content: {
        component: "select",
        label: "Content",
        options: [
          {
            label: "Cropped zone (swap)",
            value: "crop"
          },
          {
            label: "Full image",
            value: "full"
          }
        ]
      },
      width: {
        label: "Width",
        component: "slider",
        min: 0.05,
        max: 0.95,
        step: 0.01
      },
      height: {
        label: "Height",
        component: "slider",
        min: 0.05,
        max: 0.95,
        step: 0.01
      },
      horizontalMirror: {
        label: "Horizontal mirror",
        component: "checkbox"
      },
      verticalMirror: {
        label: "Vertical mirror",
        component: "checkbox"
      }
    }
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
