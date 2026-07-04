import getTestImagePaths from "@/utils/getTestImagePaths";

export const formValues = {
  images: await getTestImagePaths(),

  colors: {
    background: [
      246,
      235,
      225
    ]
  },

  motion: {
    angleSpeed: 1,
    phaseJitter: 1,
    travelMargin: 100,
    minWidthAmplitude: 200,
    minHeightAmplitude: 6
  },

  balls: {
    minSize: 200,
    maxSize: 400
  },

  lines: {
    show: true,
    color: [
      0,
      0,
      0
    ],
    weight: 1,
    maxDistance: 1000,
    alphaScale: 100
  },

  image: {
    fill: true,
    center: true
  }
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images"
  },

  image: {
    label: "Image",
    component: "nested-object",
    fields: {
      fill: {
        component: "checkbox",
        label: "Fill in buffer"
      },
      center: {
        component: "checkbox",
        label: "Center"
      }
    }
  },

  colors: {
    label: "Colors",
    component: "nested-object",
    fields: {
      background: {
        component: "color",
        label: "Background color"
      }
    }
  },

  motion: {
    label: "Motion",
    component: "nested-object",
    fields: {
      angleSpeed: {
        component: "slider",
        label: "Angle speed",
        min: 0,
        max: 3,
        step: 0.01
      },
      phaseJitter: {
        component: "slider",
        label: "Phase jitter",
        min: 0,
        max: 3,
        step: 0.01
      },
      travelMargin: {
        component: "slider",
        label: "Travel margin",
        min: 0,
        max: 300,
        step: 1
      },
      minWidthAmplitude: {
        component: "slider",
        label: "Min width amplitude",
        min: 0,
        max: 1000,
        step: 1
      },
      minHeightAmplitude: {
        component: "slider",
        label: "Min height amplitude",
        min: 0,
        max: 500,
        step: 1
      }
    }
  },

  balls: {
    label: "Balls",
    component: "nested-object",
    fields: {
      minSize: {
        component: "slider",
        label: "Min size",
        min: 10,
        max: 800,
        step: 1
      },
      maxSize: {
        component: "slider",
        label: "Max size",
        min: 10,
        max: 1000,
        step: 1
      }
    }
  },

  lines: {
    label: "Connecting lines",
    component: "nested-object",
    fields: {
      show: {
        component: "checkbox",
        label: "Show lines"
      },
      color: {
        component: "color",
        label: "Color"
      },
      weight: {
        component: "slider",
        label: "Weight",
        min: 0,
        max: 10,
        step: 0.1
      },
      maxDistance: {
        component: "slider",
        label: "Fade max distance",
        min: 50,
        max: 2000,
        step: 1
      },
      alphaScale: {
        component: "slider",
        label: "Alpha scale",
        min: 0,
        max: 255,
        step: 1
      }
    }
  }
};
