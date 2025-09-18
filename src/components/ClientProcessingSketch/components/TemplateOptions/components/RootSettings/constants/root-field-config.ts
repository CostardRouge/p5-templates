import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const sizePresetOptions: Array<{
 label: string; value: string
}> = [
  // Square
  {
    label: "[Square] 768 × 768",
    value: "768x768"
  },
  {
    label: "[Square] 1024 × 1024",
    value: "1024x1024"
  },
  {
    label: "[Square] 1080 × 1080 (Instagram)",
    value: "1080x1080"
  },
  {
    label: "[Square] 1280 × 1280",
    value: "1280x1280"
  },
  {
    label: "[Square] 2048 × 2048",
    value: "2048x2048"
  },

  // Portrait
  {
    label: "[Portrait] 768 × 1366 (default)",
    value: "768x1366"
  },
  {
    label: "[Portrait] 1080 × 1350 (Instagram post)",
    value: "1080x1350"
  },
  {
    label: "[Portrait] 1080 × 1920 (Instagram reel/story)",
    value: "1080x1920"
  },

  // Landscape
  {
    label: "[Landscape] 1366 × 768 (default)",
    value: "1366x768"
  },
  {
    label: "[Landscape] 1080 × 608 (Instagram landscape)",
    value: "1080x608"
  },
  {
    label: "[Landscape] 1920 × 1080",
    value: "1920x1080"
  }
];

export const framerateOptions = [
  1,
  5,
  10,
  24,
  30,
  48,
  60,
  120,
  240
].map( ( fps ) => ( {
  label: String( fps ),
  value: fps,
} ) );

export const rootFormConfig: Record<string, FieldConfig> = {
  sizePreset: {
    label: "Size",
    component: "select",
    options: sizePresetOptions,
    noneLabel: undefined,
  },

  animation: {
    label: "Animation",
    component: "nested-object",
    fields: {
      duration: {
        label: "Duration",
        component: "number",
        step: 1,
        min: 0,
        max: 60,
        placeholder: "seconds",
      },
      framerate: {
        label: "Framerate",
        component: "select",
        options: framerateOptions,
        asNumber: true,
      },
    },
  },
};
