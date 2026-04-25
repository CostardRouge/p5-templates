import easing from "@/p5/utils/easing";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {

  images: [
  ],

  backgroundColor: [
    246,
    235,
    225
  ],

  // Dice / scene
  useOrbitControl: true,
  diceSizeFactor: 1.5, // dice size = width / diceSizeFactor
  faceScale: 0.65, // image scale on each face (0..1)

  // Motion
  rotateSpeed: 1, // multiplies rotation progression
  easing: "easeInOutExpo", // easing function for face rotations
  repeatImages: true, // if fewer than 6 images, repeat across faces

  title: {
    ...titleDefaultValues,
  },
};

export const formConfiguration: Record<string, any> = {

  repeatImages: {
    component: "checkbox",
    label: "Repeat images if fewer than 6",
  },
  images: {
    component: "images-stack",
    label: "Images (up to 6 faces)",
  },

  backgroundColor: {
    component: "color",
    label: "Background color",
  },

  diceSizeFactor: {
    component: "slider",
    label: "Dice size factor",
    min: 0.5,
    max: 3,
    step: 0.01,
  },
  faceScale: {
    component: "slider",
    label: "Face image scale",
    min: 0.1,
    max: 1,
    step: 0.01,
  },

  // Motion
  rotateSpeed: {
    component: "slider",
    label: "Rotation speed",
    min: 0,
    max: 3,
    step: 0.01,
  },
  easing: {
    component: "select",
    label: "Rotation easing",
    options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
      label: easingFunctionName,
      value: easingFunctionName,
    } ) ),
  },

  title: {
    ...titleFormConfiguration,
  },
};
