export const formValues = {
  images: [],

  imageStyle: {
    margin: 0.1,
    scale: 0.8,
    center: true,
    clip: false,
    fill: false
  },

  randomPosition: {
    x: 0.3,
    y: 0.5
  },
  randomAngle: 15,
  animationCount: 3,
  displayEasing: "linear",

  backgroundColor: [
    246,
    235,
    225
  ]
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images"
  },
  randomAngle: {
    label: "Rotation angle",
    component: "slider",
    min: 0,
    max: 360
  },
  animationCount: {
    label: "Animation count",
    component: "slider",
    min: 0,
    max: 10
  },
  randomPosition: {
    label: "Random position",
    component: "nested-object",
    fields: {
      x: {
        label: "X",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.1
      },
      y: {
        label: "Y",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.1
      }
    }
  },
  imageStyle: {
    label: "Image style",
    component: "nested-object",
    fields: {
      margin: {
        label: "Image margin",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.005
      },
      scale: {
        label: "Scale",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
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
      }
    }
  },
  displayEasing: {
    component: "easing",
    label: "Display easing function"
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
