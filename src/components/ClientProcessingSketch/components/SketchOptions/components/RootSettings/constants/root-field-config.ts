import {
  FieldConfig,
  SelectOption
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

const createFormatOption = (
  width: number,
  height: number,
  name?: string,
  group?: string
): SelectOption => ( {
  label: `${ width } × ${ height }${ name ? ` (${ name })` : "" }`,
  value: `${ width }x${ height }`,
  group
} );

// Real canvas resolutions only. Fullscreen used to smuggle two sentinel
// entries in here, which forced every other consumer (the export size cell,
// the embed dialog) to filter them back out — it is a presentation mode, not a
// size, and lives in the zoom controls' menu now.
export const formatOptions: SelectOption[] = [
  // square
  createFormatOption(
    768,
    768,
    undefined,
    "Square"
  ),
  createFormatOption(
    1024,
    1024,
    undefined,
    "Square"
  ),
  createFormatOption(
    1080,
    1080,
    undefined,
    "Square"
  ),
  createFormatOption(
    1280,
    1280,
    undefined,
    "Square"
  ),

  // portrait
  createFormatOption(
    768,
    1366,
    undefined,
    "Portrait"
  ),
  createFormatOption(
    1080,
    1350,
    "Instagram post",
    "Portrait"
  ),
  createFormatOption(
    1080,
    1440,
    "Instagram tall post",
    "Portrait"
  ),
  createFormatOption(
    1080,
    1920,
    "Instagram reel/story",
    "Portrait"
  ),

  // landscape
  createFormatOption(
    1080,
    608,
    "Instagram landscape",
    "Landscape"
  ),
  createFormatOption(
    5120,
    1080,
    "Instagram ultra wide",
    "Landscape"
  ),
  createFormatOption(
    1366,
    768,
    undefined,
    "Landscape"
  ),
  createFormatOption(
    1920,
    1080,
    "Full HD",
    "Landscape"
  ),
  createFormatOption(
    3840,
    2160,
    "4K",
    "Landscape"
  ),
  createFormatOption(
    1920 * 4,
    1080 * 4,
    "Ultra HD",
    "Landscape"
  ),

  // portrait
  createFormatOption(
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
  25,
  30,
  48,
  50,
  60,
  120,
  240
].map( ( fps ) => ( {
  label: String( fps ),
  value: fps
} ) );

const rootFormConfig: Record<string, FieldConfig> = {
  format: {
    label: "Canvas size",
    component: "format",
    options: formatOptions
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
