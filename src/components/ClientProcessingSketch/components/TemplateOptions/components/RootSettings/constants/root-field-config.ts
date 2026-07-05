import {
  FieldConfig,
  SelectOption
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import {
  FULLSCREEN_PRESET_LABEL,
  FULLSCREEN_PRESET_VALUE
} from "@/lib/fullscreen/constants";

const createSizePresetOption = (
  width: number,
  height: number,
  name?: string,
  group?: string
): SelectOption => ( {
  label: `${ width } × ${ height }${ name ? ` (${ name })` : "" }`,
  value: `${ width }x${ height }`,
  group
} );

export const sizePresetOptions: SelectOption[] = [
  // Desktop-only fullscreen mode. Not a fixed W×H — the size select recognises
  // this sentinel and drives the browser Fullscreen API instead (rendered only
  // where supported). See ControlledSizePresetSelect / fullscreenViewport.
  {
    label: FULLSCREEN_PRESET_LABEL,
    value: FULLSCREEN_PRESET_VALUE
  },

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
    1440,
    "Instagram tall post",
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
    5120,
    1080,
    "Instagram ultra wide",
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
    3840,
    2160,
    "4K",
    "Landscape"
  ),
  createSizePresetOption(
    1920 * 4,
    1080 * 4,
    "Ultra HD",
    "Landscape"
  ),

  // portrait
  createSizePresetOption(
    2160,
    3840,
    "4K",
    "Portrait"
  )
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
  value: fps
} ) );

const rootFormConfig: Record<string, FieldConfig> = {
  sizePreset: {
    label: "Canvas size",
    component: "size-preset",
    options: sizePresetOptions
  },

  animation: {
    label: "Animation",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      duration: {
        label: "Duration (s)",
        component: "slider",
        step: 1,
        // Floor at 1 to match SketchAnimationSchema (`duration.min(1)`): a 0 here
        // is schema-invalid and used to slip through `watch()` un-clamped and
        // trip the `duration || default` fallbacks downstream.
        min: 1,
        max: 60
      },
      framerate: {
        label: "Framerate",
        component: "select",
        options: framerateOptions,
        asNumber: true
      }
    }
  }
};

export default rootFormConfig;
