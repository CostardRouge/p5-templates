import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

export const formValues = {
  ...( await getCommonPhotoValues() ),

  cornerRadius: 0,
  maxSlides: 8,
  margin: 0,
  transition: "slide",
  direction: "left",
  transitionPortion: 0.4,
  breathing: 0.05
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  maxSlides: {
    component: "slider",
    label: "Max slides",
    min: 1,
    max: 24,
    step: 1
  },
  margin: {
    component: "slider",
    label: "Outer margin",
    min: 0,
    max: 320,
    step: 1
  },
  transition: {
    component: "select",
    label: "Transition",
    options: [
      {
        label: "Fade",
        value: "fade"
      },
      {
        label: "Slide",
        value: "slide"
      },
      {
        label: "Wipe",
        value: "wipe"
      },
      {
        label: "Zoom",
        value: "zoom"
      }
    ]
  },
  direction: {
    component: "select",
    label: "Direction",
    options: [
      {
        label: "Left",
        value: "left"
      },
      {
        label: "Right",
        value: "right"
      },
      {
        label: "Up",
        value: "up"
      },
      {
        label: "Down",
        value: "down"
      }
    ]
  },
  transitionPortion: {
    component: "slider",
    label: "Transition portion",
    min: 0.1,
    max: 0.9,
    step: 0.01
  },
  breathing: {
    component: "slider",
    label: "Breathing zoom",
    min: 0,
    max: 0.3,
    step: 0.005
  }
};
