import {
  formConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

/**
 * Standard title configuration for form options
 */

const titleFormConfiguration = {
  label: "Title",
  component: "nested-object",
  fields: {
    show: {
      label: "Show title",
      component: "checkbox",
    },
    ...formConfig.text,
    displayFrom: {
      label: "Display from (0-1)",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.01,
    },
    displayTo: {
      label: "Display to (0-1)",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.01,
    },
  },
};

export default titleFormConfiguration;
