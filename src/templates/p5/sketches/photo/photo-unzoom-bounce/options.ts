import getTestImagePaths from "@/utils/getTestImagePaths";
import oscillationDefaultValues from "@/p5/utils/oscillator/oscillatorDefaultValues";
import oscillationFormConfiguration from "@/p5/utils/oscillator/oscillatorFormConfiguration";

export const formValues = {
  images: await getTestImagePaths(),
  count: 100,
  zoom: false,
  rotate: false,
  scaleStart: 0,
  scaleEnd: 0.3,
  scaleEasingFunctionName: "easeInQuint",
  oscillation: {
    ...oscillationDefaultValues,
    // A "bounce" reads best as a linear ping-pong.
    waveform: "triangle"
  },
  backgroundColor: [
    255,
    255,
    255
  ]
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images"
  },
  count: {
    label: "Image steps count",
    component: "slider",
    min: 1,
    max: 1000,
    step: 1
  },
  zoom: {
    label: "Zoom mode (instead of unzoom)",
    component: "checkbox"
  },
  rotate: {
    label: "Rotate images",
    component: "checkbox"
  },
  scaleStart: {
    label: "Scale start",
    component: "slider",
    min: 0,
    max: 2,
    step: 0.1
  },
  scaleEnd: {
    label: "Scale end",
    component: "slider",
    min: 0,
    max: 2,
    step: 0.1
  },
  scaleEasingFunctionName: {
    component: "easing",
    label: "Scale easing"
  },
  oscillation: oscillationFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
