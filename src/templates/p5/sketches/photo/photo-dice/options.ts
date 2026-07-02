import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

import getTestImagePaths from "@/utils/getTestImagePaths";

export const formValues = {
  images: await getTestImagePaths(),

  backgroundColor: [
    246,
    235,
    225
  ],

  useOrbitControl: true,
  diceSizeFactor: 1.5,
  faceScale: 0.65,

  rotateSpeed: 1,
  easing: "easeInOutExpo",
  repeatImages: true,

  title: titleDefaultValues
};

export const formConfiguration: Record<string, any> = {

  repeatImages: {
    component: "checkbox",
    label: "Repeat images if fewer than 6"
  },
  images: {
    component: "images-stack",
    label: "Images (up to 6 faces)"
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  diceSizeFactor: {
    component: "slider",
    label: "Dice size factor",
    min: 0.1,
    max: 9,
    step: 0.01
  },
  faceScale: {
    component: "slider",
    label: "Face image scale",
    min: 0.1,
    max: 6,
    step: 0.01
  },

  // Motion
  rotateSpeed: {
    component: "slider",
    label: "Rotation speed (snaps to whole cycles/loop)",
    min: 0,
    max: 3,
    step: 0.01
  },
  easing: {
    component: "easing",
    label: "Rotation easing"
  },

  title: titleFormConfiguration
};
