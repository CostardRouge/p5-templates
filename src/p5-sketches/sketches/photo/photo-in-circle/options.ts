import {
  Blend
} from "@/types/sketch.types";
import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import easing from "@/p5-sketches/utils/easing";

export const formValues = {
  // Assets
  images: [
  ],

  // Colors
  backgroundColor: [
    246,
    235,
    225
  ],
  textColor: [
    0
  ],

  // Typography / Title
  font: "martian",
  title: "",
  showTitle: true,
  titleSize: 128,
  titleProgressStart: 0.0,
  titleProgressEnd: 0.6,
  titleBlendMode: "exclusion",

  // Orbit motion
  orbitSpeed: 1, // multiplier for revolution
  outerRadiusFactor: 0.8, // away radius relative to canvas size
  innerRadiusFactor: 0.25, // near radius relative to canvas size

  // Scaling
  scaleStart: 1.0,
  scaleEnd: 0.65,
  scaleEasing: "easeInOutQuint",

  // Rotation by index
  indexRotationDegrees: 180,
  indexRotationEasing: "easeInExpo",

  // Rotation by noise
  noiseXDiv: 2,
  noiseRotationFromDeg: 360,
  noiseRotationToDeg: 0,
  noiseRotationEasing: "easeInOutQuint",

  // Image drawing
  clipImage: false,
  imageMargin: 0,
};

export const formConfiguration: Record<string, any> = {
  // Assets
  images: {
    component: "images-stack",
    label: "Images",
  },

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
  textColor: {
    component: "color",
    label: "Text color",
  },

  // Typography / Title
  font: {
    component: "select",
    label: "Font name",
    options: fontNames.map( ( name ) => ( {
      value: name,
      label: name,
    } ) ),
  },
  title: {
    component: "text",
    label: "Custom title (empty → default)",
  },
  showTitle: {
    component: "checkbox",
    label: "Show title",
  },
  titleSize: {
    component: "slider",
    label: "Title size",
    min: 12,
    max: 300,
    step: 1,
  },
  titleProgressStart: {
    component: "slider",
    label: "Title visible from",
    min: 0,
    max: 1,
    step: 0.001,
  },
  titleProgressEnd: {
    component: "slider",
    label: "Title visible to",
    min: 0,
    max: 1,
    step: 0.001,
  },
  titleBlendMode: {
    component: "select",
    label: "Title blend mode",
    options: Blend.options.map( ( v ) => ( {
      value: v,
      label: v,
    } ) ),
  },

  // Orbit motion
  orbitSpeed: {
    component: "slider",
    label: "Orbit speed",
    min: 0,
    max: 3,
    step: 0.01,
  },
  outerRadiusFactor: {
    component: "slider",
    label: "Outer radius factor",
    min: 0,
    max: 1.5,
    step: 0.001,
  },
  innerRadiusFactor: {
    component: "slider",
    label: "Inner radius factor",
    min: 0,
    max: 1.0,
    step: 0.001,
  },

  // Scaling
  scaleStart: {
    component: "slider",
    label: "Scale start",
    min: 0.1,
    max: 2,
    step: 0.01,
  },
  scaleEnd: {
    component: "slider",
    label: "Scale end",
    min: 0.1,
    max: 2,
    step: 0.01,
  },
  scaleEasing: {
    component: "select",
    label: "Scale easing",
    options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
      label: easingFunctionName,
      value: easingFunctionName,
    } ) ),
  },

  // Rotation by index
  indexRotationDegrees: {
    component: "slider",
    label: "Index rotation (deg)",
    min: 0,
    max: 360,
    step: 1,
  },
  indexRotationEasing: {
    component: "select",
    label: "Index rotation easing",
    options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
      label: easingFunctionName,
      value: easingFunctionName,
    } ) ),
  },

  // Rotation by noise
  noiseXDiv: {
    component: "slider",
    label: "Noise X divisor",
    min: 0.1,
    max: 5,
    step: 0.01,
  },
  noiseRotationFromDeg: {
    component: "slider",
    label: "Noise rotation from (deg)",
    min: 0,
    max: 720,
    step: 1,
  },
  noiseRotationToDeg: {
    component: "slider",
    label: "Noise rotation to (deg)",
    min: 0,
    max: 720,
    step: 1,
  },
  noiseRotationEasing: {
    component: "select",
    label: "Noise rotation easing",
    options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
      label: easingFunctionName,
      value: easingFunctionName,
    } ) ),
  },

  // Image drawing
  clipImage: {
    component: "checkbox",
    label: "Clip image to margin",
  },
  imageMargin: {
    component: "slider",
    label: "Image margin",
    min: 0,
    max: 200,
    step: 1,
  },
};
