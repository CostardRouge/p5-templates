import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import getTestImagePaths from "@/utils/getTestImagePaths";

export const formValues = {
  // Assets
  images: await getTestImagePaths(),

  margin: 0.1,
  scale: 1,
  center: true,
  clip: false,
  fill: false,

  animation: {
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
    noiseRotationEasing: "easeInOutQuint"
  },

  backgroundColor: [
    246,
    235,
    225
  ],

  title: titleDefaultValues
};

export const formConfiguration: Record<string, any> = {
  // Assets
  images: {
    component: "images-stack",
    label: "Images"
  },

  margin: {
    label: "Image margin",
    component: "slider",
    min: 0,
    max: 0.45,
    step: 0.005
  },
  center: {
    label: "Center image",
    component: "checkbox"
  },
  clip: {
    label: "Clip",
    component: "checkbox"
  },
  fill: {
    label: "Fill",
    component: "checkbox"
  },

  animation: {
    label: "Animation",
    component: "nested-object",
    fields: {
      // Orbit motion
      orbitSpeed: {
        component: "slider",
        label: "Orbit speed",
        min: 0,
        max: 3,
        step: 0.01
      },
      outerRadiusFactor: {
        component: "slider",
        label: "Outer radius factor",
        min: 0,
        max: 1.5,
        step: 0.001
      },
      innerRadiusFactor: {
        component: "slider",
        label: "Inner radius factor",
        min: 0,
        max: 1.0,
        step: 0.001
      },

      // Scaling
      scaleStart: {
        component: "slider",
        label: "Scale start",
        min: 0.1,
        max: 2,
        step: 0.01
      },
      scaleEnd: {
        component: "slider",
        label: "Scale end",
        min: 0.1,
        max: 2,
        step: 0.01
      },
      scaleEasing: {
        component: "easing",
        label: "Scale easing"
      },

      // Rotation by index
      indexRotationDegrees: {
        component: "slider",
        label: "Index rotation (deg)",
        min: 0,
        max: 360,
        step: 1
      },
      indexRotationEasing: {
        component: "easing",
        label: "Index rotation easing"
      },

      // Rotation by noise
      noiseXDiv: {
        component: "slider",
        label: "Noise X divisor",
        min: 0.1,
        max: 5,
        step: 0.01
      },
      noiseRotationFromDeg: {
        component: "slider",
        label: "Noise rotation from (deg)",
        min: 0,
        max: 720,
        step: 1
      },
      noiseRotationToDeg: {
        component: "slider",
        label: "Noise rotation to (deg)",
        min: 0,
        max: 720,
        step: 1
      },
      noiseRotationEasing: {
        component: "easing",
        label: "Noise rotation easing"
      }
    }
  },

  title: titleFormConfiguration,

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color"
  }

};
