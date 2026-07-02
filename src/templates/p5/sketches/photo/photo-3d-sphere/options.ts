import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import getTestImagePaths from "@/utils/getTestImagePaths";

// Default values only
export const formValues = {
  // Assets
  images: await getTestImagePaths(),

  // Where the photos sit on the invisible sphere
  layout: {
    distribution: "sphere",
    faceCount: 0,
    sphereRadius: 920,
    photoSize: 0.82,
    photoShape: "auto",
    zoom: -1200
  },

  // How the tour travels from one photo to the next
  motion: {
    tourSpeed: 1,
    holdRatio: 0.45,
    easing: "easeInOutCubic"
  },

  // Look & feel
  style: {
    focusDim: 0.65,
    hideBackFaces: false,
    photoFrame: true,
    frameColor: [
      255,
      255,
      255,
      255
    ],
    frameThickness: 0.03,
    backgroundColor: [
      8,
      8,
      12
    ],
    variableBackgroundColor: false
  },

  title: titleDefaultValues
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images"
  },

  layout: {
    label: "Sphere layout",
    component: "nested-object",
    fields: {
      distribution: {
        label: "Distribution",
        component: "select",
        options: [
          {
            label: "Sphere (even spread)",
            value: "sphere"
          },
          {
            label: "Ring (carousel)",
            value: "ring"
          },
          {
            label: "Vertical ring (wheel)",
            value: "vertical-ring"
          },
          {
            label: "Spiral",
            value: "spiral"
          }
        ]
      },
      faceCount: {
        label: "Face count (0 = one per photo)",
        component: "slider",
        min: 0,
        max: 48,
        step: 1
      },
      sphereRadius: {
        label: "Sphere radius",
        component: "slider",
        min: 200,
        max: 1500,
        step: 10
      },
      photoSize: {
        label: "Photo size",
        component: "slider",
        min: 0.2,
        max: 1.5,
        step: 0.01
      },
      photoShape: {
        label: "Photo shape",
        component: "select",
        options: [
          {
            label: "Auto (canvas)",
            value: "auto"
          },
          {
            label: "Portrait",
            value: "portrait"
          },
          {
            label: "Square",
            value: "square"
          },
          {
            label: "Landscape",
            value: "landscape"
          }
        ]
      },
      zoom: {
        label: "Zoom (Z translate)",
        component: "slider",
        min: -5000,
        max: 0,
        step: 10
      }
    }
  },

  motion: {
    label: "Motion",
    component: "nested-object",
    fields: {
      tourSpeed: {
        label: "Tour speed (loops per cycle, snaps to whole tours/loop)",
        component: "slider",
        min: 0.25,
        max: 4,
        step: 0.05
      },
      holdRatio: {
        label: "Hold on each photo",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      easing: {
        label: "Transition easing",
        component: "easing"
      }
    }
  },

  style: {
    label: "Style",
    component: "nested-object",
    fields: {
      focusDim: {
        label: "Dim distant photos",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      hideBackFaces: {
        label: "Hide back faces",
        component: "checkbox"
      },
      photoFrame: {
        label: "Photo frame",
        component: "checkbox"
      },
      frameColor: {
        label: "Frame color",
        component: "color"
      },
      frameThickness: {
        label: "Frame thickness",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.01
      },
      backgroundColor: {
        label: "Background color",
        component: "color"
      },
      variableBackgroundColor: {
        label: "Animated background color",
        component: "checkbox"
      }
    }
  },

  title: titleFormConfiguration
};
