import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/templates/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/templates/p5/utils/title/titleFormConfiguration";

export const formValues = {
  images: [
  ],

  colors: {
    background: [
      0,
      0,
      0
    ],
    text: [
      128,
      128,
      255
    ],
  },

  title: titleDefaultValues,

  cylinder: {
    vertical: false,
    rotateX: true,
    rotateZ: false,
    zoom: -2000,
    variableZoom: false,
  },

  animation: {
    duration: 8,
    framerate: 60,
    variableBackgroundColor: true,
  },
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images",
  },

  colors: {
    label: "Colors",
    component: "nested-object",
    fields: {
      background: {
        component: "color",
        label: "Background color",
      },
      text: {
        component: "color",
        label: "Text color",
      },
    },
  },

  title: titleFormConfiguration,

  cylinder: {
    label: "Cylinder",
    component: "nested-object",
    fields: {
      vertical: {
        component: "checkbox",
        label: "Vertical orientation",
      },
      rotateX: {
        component: "checkbox",
        label: "Rotate X",
      },
      rotateZ: {
        component: "checkbox",
        label: "Rotate Z",
      },
      zoom: {
        component: "slider",
        label: "Zoom (Z translate)",
        min: -10000,
        max: 1000,
        step: 10,
      },
      variableZoom: {
        component: "checkbox",
        label: "Animated zoom",
      },
    },
  },

  animation: {
    label: "Animation",
    component: "nested-object",
    fields: {
      duration: {
        component: "slider",
        label: "Duration (seconds)",
        min: 1,
        max: 60,
        step: 0.5,
      },
      framerate: {
        component: "slider",
        label: "Framerate",
        min: 1,
        max: 120,
        step: 1,
      },
      variableBackgroundColor: {
        component: "checkbox",
        label: "Animated background color",
      },
    },
  },
};
