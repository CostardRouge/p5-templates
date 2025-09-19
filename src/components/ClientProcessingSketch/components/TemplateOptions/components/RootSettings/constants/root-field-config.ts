import {
  FieldConfig, SelectOption
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

const createSizePresetOption = (
  width: number, height: number, name?: string, group?: string
): SelectOption => ( {
  label: `${ width } × ${ height }${ name ? ` (${ name })` : "" }`,
  value: `${ width }x${ height }`,
  group
} );

export const sizePresetOptions: SelectOption[] = [
  // square
  createSizePresetOption(
    768,
    768,
    undefined,
    "Square"
  ),
  createSizePresetOption(
    1024,
    1024,
    undefined,
    "Square"
  ),
  createSizePresetOption(
    1080,
    1080,
    undefined,
    "Square"
  ),
  createSizePresetOption(
    1280,
    1280,
    undefined,
    "Square"
  ),

  // portrait
  createSizePresetOption(
    768,
    1366,
    undefined,
    "Portrait"
  ),
  createSizePresetOption(
    1080,
    1350,
    "Instagram post",
    "Portrait"
  ),
  createSizePresetOption(
    1080,
    1920,
    "Instagram reel/story",
    "Portrait"
  ),

  // landscape
  createSizePresetOption(
    1080,
    608,
    "Instagram landscape",
    "Landscape"
  ),
  createSizePresetOption(
    1366,
    768,
    undefined,
    "Landscape"
  ),
  createSizePresetOption(
    1920,
    1080,
    "Full HD",
    "Landscape"
  ),
  createSizePresetOption(
    1920 * 4,
    1080 * 4,
    "Ultra HD",
    "Landscape"
  ),
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

const rootFormConfig: Record<string, FieldConfig> = {
  sizePreset: {
    label: "Canvas size",
    component: "size-preset",
    options: sizePresetOptions,
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
        placeholder: "x seconds",
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

export default rootFormConfig;