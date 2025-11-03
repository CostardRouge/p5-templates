import {
  Blend
} from "@/types/sketch.types";

export const formValues = {
  // Data
  consumeTestImages: true,
  images: [
  ], // supplied by "images-stack"

  // Colors
  backgroundColor: [
    246,
    235,
    225
  ],
  textColor: [
    0
  ],

  // Typography
  font: "martian",
  title: "", // empty => uses default "PHOTO\nDICE"
  showTitle: true,
  titleSize: 128,
  titleProgressStart: 0.0, // visible when progression in [start, end]
  titleProgressEnd: 0.2,
  titleBlendMode: "exclusion", // p5 blend mode

  // Dice / scene
  useOrbitControl: true,
  diceSizeFactor: 1.5, // dice size = width / diceSizeFactor
  faceScale: 0.65, // image scale on each face (0..1)

  // Motion
  rotateSpeed: 1, // multiplies rotation progression
  easing: "easeInOutExpo", // easing function for face rotations
  repeatImages: true // if fewer than 6 images, repeat across faces
};

export const formConfiguration: Record<string, any> = {
  // Data
  consumeTestImages: {
    component: "checkbox",
    label: "Use test images when empty"
  },
  repeatImages: {
    component: "checkbox",
    label: "Repeat images if fewer than 6"
  },
  images: {
    component: "images-stack",
    label: "Images (up to 6 faces)"
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  textColor: {
    component: "color",
    label: "Text color"
  },

  // Typography
  font: {
    component: "text", // switch to "select" if you enumerate string.fonts keys
    label: "Font (string.fonts key)",
    placeholder: "martian"
  },
  title: {
    component: "text",
    label: "Custom title (leave empty for default)"
  },
  showTitle: {
    component: "checkbox",
    label: "Show title"
  },
  titleSize: {
    component: "slider",
    label: "Title size",
    min: 12,
    max: 300,
    step: 1
  },
  titleProgressStart: {
    component: "slider",
    label: "Title visible from",
    min: 0,
    max: 1,
    step: 0.001
  },
  titleProgressEnd: {
    component: "slider",
    label: "Title visible to",
    min: 0,
    max: 1,
    step: 0.001
  },
  titleBlendMode: {
    component: "select",
    label: "Title blend mode",
    options: Blend.options.map( blendOption => ( {
      value: blendOption,
      label: blendOption
    } ) )
  },

  // Dice / scene
  useOrbitControl: {
    component: "checkbox",
    label: "Orbit control"
  },
  diceSizeFactor: {
    component: "slider",
    label: "Dice size factor",
    min: 0.5,
    max: 3,
    step: 0.01
  },
  faceScale: {
    component: "slider",
    label: "Face image scale",
    min: 0.1,
    max: 1,
    step: 0.01
  },

  // Motion
  rotateSpeed: {
    component: "slider",
    label: "Rotation speed",
    min: 0,
    max: 3,
    step: 0.01
  },
  easing: {
    component: "select",
    label: "Rotation easing",
    options: [
      {
        label: "Ease InOut Expo",
        value: "easeInOutExpo"
      },
      {
        label: "Ease InOut Elastic",
        value: "easeInOutElastic"
      },
      {
        label: "Ease InOut Circ",
        value: "easeInOutCirc"
      },
      {
        label: "Ease InOut Sine",
        value: "easeInOutSine"
      },
      {
        label: "Ease InOut Quad",
        value: "easeInOutQuad"
      }
    ]
  }
};
