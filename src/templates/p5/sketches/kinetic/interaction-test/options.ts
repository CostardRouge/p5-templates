import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

export const formValues = {
  interaction: {
    ...interactionFormValues,
    // Start with mouse + 3 orbit pointers so the sketch works immediately
    mouse: {
      ...interactionFormValues.mouse,
      enabled: true
    },
    orbit: {
      ...interactionFormValues.orbit,
      enabled: true,
      count: 3
    }
  },
  backgroundColor: [
    20,
    20,
    20
  ]
};

export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
