import easing from "@/p5-sketches/utils/easing";

export const formValues = {
  images: [
  ],
  count: 100,
  zoom: false,
  rotate: false,
  scaleStart: 0,
  scaleEnd: 0.3,
  scaleEasingFunctionName: "easeInQuint",
  animationProgression: "linearProgression",
  backgroundColor: [
    255,
    255,
    255
  ],
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images",
  },
  count: {
    label: "Image steps count",
    component: "slider",
    min: 1,
    max: 1000,
    step: 1,
  },
  zoom: {
    label: "Zoom mode (instead of unzoom)",
    component: "checkbox",
  },
  rotate: {
    label: "Rotate images",
    component: "checkbox",
  },
  scaleStart: {
    label: "Scale start",
    component: "slider",
    min: 0,
    max: 2,
    step: 0.1,
  },
  scaleEnd: {
    label: "Scale end",
    component: "slider",
    min: 0,
    max: 2,
    step: 0.1,
  },
  scaleEasingFunctionName: {
    component: "select",
    label: "Scale easing",
    options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
      label: easingFunctionName,
      value: easingFunctionName,
    } ) ),
  },
  animationProgression: {
    component: "select",
    label: "Animation progression",
    options: [
      {
        label: "Triangle progression",
        value: "triangleProgression",
      },
      {
        label: "Linear progression",
        value: "linearProgression",
      },
    ],
  },
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
};
