/**
 * Options configuration for photo-exif GSAP template
 * This follows the same pattern as p5.js sketch options
 */

import {
  PhotoExifTemplateOptions
} from "./types";

/**
 * Default options for the photo-exif template
 */
export const defaultOptions: PhotoExifTemplateOptions = {
  animation: {
    duration: 5,
    framerate: 30,
  },
  photo: {
    image: null,
    margin: 0.1,
    backgroundColor: [
      255,
      255,
      255
    ],
  },
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
    ],
  },
  textOverrides: {
    topLeft: "",
    topRight: "",
    bottomLeft: "",
    bottomRight: "",
  },
};

/**
 * Available font options
 */
const fontNames = [
  "agiro",
  "cloitre",
  "comfortaa",
  "libre-baskerville",
  "lora-italic",
  "lora-regular",
  "martian",
  "monoton",
  "montepetrum",
  "multicoloure",
  "open-sans",
  "passion-one",
  "peix",
  "playfair-display",
  "spacemono-italic",
  "spacemono-regular",
  "stardom",
  "tilt-prism",
];

/**
 * Form configuration for UI generation
 * This defines how the options UI should be rendered
 */
export const formConfiguration: Record<string, any> = {
  animation: {
    label: "Animation",
    component: "nested-object",
    fields: {
      duration: {
        label: "Duration (seconds)",
        component: "slider",
        min: 1,
        max: 60,
        step: 0.5,
      },
      framerate: {
        label: "Framerate (fps)",
        component: "select",
        options: [
          {
            value: 24,
            label: "24 fps"
          },
          {
            value: 30,
            label: "30 fps"
          },
          {
            value: 60,
            label: "60 fps"
          },
        ],
      },
    },
  },
  photo: {
    label: "Photo",
    component: "nested-object",
    fields: {
      image: {
        component: "image",
        label: "Image",
      },
      margin: {
        label: "Image margin",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.005,
      },
      backgroundColor: {
        component: "color",
        label: "Background color",
      },
    },
  },
  font: {
    label: "Font style",
    component: "nested-object",
    fields: {
      size: {
        component: "slider",
        label: "Font size",
        min: 1,
        max: 244,
      },
      face: {
        component: "select",
        label: "Font name",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName,
        } ) ),
      },
      color: {
        component: "color",
        label: "Font color",
      },
      stroke: {
        component: "color",
        label: "Font stroke",
      },
    },
  },
  textOverrides: {
    label: "Text overrides",
    component: "nested-object",
    fields: {
      topLeft: {
        component: "text",
        label: "Top left",
      },
      topRight: {
        component: "text",
        label: "Top right",
      },
      bottomLeft: {
        component: "text",
        label: "Bottom left",
      },
      bottomRight: {
        component: "text",
        label: "Bottom right",
      },
    },
  },
};
