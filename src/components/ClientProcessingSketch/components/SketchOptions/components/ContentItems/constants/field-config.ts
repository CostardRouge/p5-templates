import type {
  ZodDiscriminatedUnion, ZodObject
} from "zod";
import {
  Blend,
  type ContentItem,
  HorizontalAlign,
  ImageItemAnimations,
  ImagesStackAnimations,
  PatternSchema,
  SPECS_SOUND_PRESETS,
  SpecsHighlightSchema,
  SpecsSoundRepeatSchema,
  SpecsVisibilitySchema,
  VerticalAlign,
  VisualOptions
} from "@/types/sketch.types";

// Step 1: Define a common base for all config types
interface BaseConfig {
  label?: string; // Label is often optional (e.g., inside a group)
  placeholder?: string;
  /**
   * Default value used when a conditional-group branch is (re)selected and
   * builds a fresh object for its fields. Optional; each component otherwise
   * falls back to a sensible zero value.
   */
  default?: unknown;
  /**
   * Marks a field injected by the platform rather than declared by the
   * sketch's own options.ts. Today only the interaction-bindings plugin's
   * shared Interaction panel sets it: the form renders a managed interaction
   * field against the top-level `interactive` namespace (and only while a
   * binding needs it), where a sketch-declared one edits the sketch scope
   * unconditionally.
   */
  managed?: boolean;
}

// Step 2: Define the config shape for each component type

// For simple inputs like 'text', 'textarea'
interface SimpleInputConfig extends BaseConfig {
  component: "text" | "textarea";
}

// For 'number' inputs
interface NumberInputConfig extends BaseConfig {
  component: "number";
  step?: number;
  min?: number;
  max?: number;
}

// For 'checkbox' inputs
interface CheckboxInputConfig extends BaseConfig {
  component: "checkbox";
}

// For 'range' inputs
interface RangeInputConfig extends BaseConfig {
  component: "slider";
  step?: number;
  min?: number;
  max?: number;
}

// For 'color' inputs
interface ColorInputConfig extends BaseConfig {
  component: "color";
}

export interface FormatConfig extends BaseConfig {
  component: "format";
  options: SelectOption[];
}

// For 'select' inputs
export type SelectOption = {
  label: string;
  value: string | number;
  group?: string;
};

interface SelectConfig extends BaseConfig {
  component: "select";
  noneLabel?: string;
  asNumber?: boolean;
  options: SelectOption[];
}

// For 'multi-select' inputs: a checkbox list bound to a string[] value, letting
// the user tick any combination of the options.
interface MultiSelectConfig extends BaseConfig {
  component: "multi-select";
  options: SelectOption[];
}

// For static, non-conditional nested objects
export interface NestedObjectConfig extends BaseConfig {
  component: "nested-object";
  // The 'fields' property contains a map where keys are field names
  // and values are any valid FieldConfig. This enables recursion.
  fields: Record<string, FieldConfig>;
  /** Whether the nested-object collapsible starts expanded. Default: false. */
  initialExpanded?: boolean;
}

// For polymorphic/conditional field groups (the most complex one)
export interface ConditionalGroupConfig extends BaseConfig {
  component: "conditional-group";
  // The property name within the object to watch for changes
  conditionalOn: string;
  // The configuration for the dropdown that selects the type
  typeSelector: Omit<SelectConfig, "component">; // It's a select, but we don't need the 'component' key here
  // A map of type names to their corresponding field configurations
  configs: Record<string, Record<string, FieldConfig>>;
  // Zod schema used to create default objects when the type changes. Optional:
  // without one, defaults are derived per-field from the branch's configs.
  schema?: ZodDiscriminatedUnion<any, any> | ZodObject<any>;
  // When true, omit the empty "--" (None) option from the selector. Use it for
  // required discriminators that should always resolve to a concrete variant.
  hideNone?: boolean;
}

type Scope =
  | "global"
  | {
    slide: number;
  };

interface HiddenConfig extends BaseConfig {
  component: "hidden";
}

// The standardized JSON field, on par with the asset kinds (images, videos,
// audios). Renders an "Upload .json" file picker plus a text editor; the
// stored value is the parsed JSON once valid, or the raw string mid-edit.
interface JsonConfig extends BaseConfig {
  component: "json";
  /** Rows for the text editor. Defaults to 4. */
  rows?: number;
  /** `accept` attribute for the file picker. Defaults to `.json`. */
  accept?: string;
}

interface ImagesStackConfig extends BaseConfig {
  component: "images-stack";
  assetsName?: string;
  scope?: Scope;
  jobId?: string;
  label?: string;
}

interface ImageConfig extends BaseConfig {
  component: "image";
  assetsName?: string;
  scope?: Scope;
  jobId?: string;
  label?: string;
}

interface ItemListConfig extends BaseConfig {
  component: "item-list";
  itemConfig: FieldConfig;
  minItems?: number;
  maxItems?: number;
  defaultItems?: any[];
  locked?: boolean;
}

interface HiddenFieldConfig extends BaseConfig {
  component: "hidden";
}

// The embedded-sketch layer's chooser: a thumbnail tile naming the sketch the
// layer runs, which opens the catalogue picker. A plain select was rejected —
// nobody picks a visual out of 298 names, and the thumbnails already exist.
interface SketchPickerConfig extends BaseConfig {
  component: "sketch-picker";
}

interface EasingConfig extends BaseConfig {
  component: "easing";
}

// For 2D vector inputs: a draggable pad that edits an { x, y } pair at once,
// instead of two separate text/slider fields. The pad's Y axis points up, so
// dragging the handle to the top yields the max value.
export interface Vector2DConfig extends BaseConfig {
  component: "vector2d";
  /**
   * When false, both axes are constrained to non-negative values ([0, max]) so
   * the vector can only point up/right (useful for scaling strength down to 0
   * without flipping direction). Defaults to true: a centered [min, max] pad.
   */
  allowNegative?: boolean;
  /** Shared lower bound. Defaults to -1 (or 0 when `allowNegative` is false). */
  min?: number;
  /** Shared upper bound. Defaults to 1. */
  max?: number;
  /** Shared snapping increment. Defaults to 0.01. */
  step?: number;
  /** Per-axis overrides, merged over the shared min/max/step. */
  xAxis?: {
    min?: number;
    max?: number;
    step?: number;
  };
  yAxis?: {
    min?: number;
    max?: number;
    step?: number;
  };
  /**
   * Invert the vertical axis so the top of the pad is the minimum value — use
   * for screen-space positions where dragging up should move toward the top.
   */
  yDown?: boolean;
}

// Source picker for HUD widgets: options are derived at render time from the
// live sketch settings + built-in keys (see ControlledSourceSelect).
interface SourceSelectConfig extends BaseConfig {
  component: "source-select";
}

// Parameter-key picker for key lists (breakdown snap / exclude): the sketch's
// key-paths plus their groups, derived at render time (see ControlledKeySelect).
interface KeySelectConfig extends BaseConfig {
  component: "key-select";
  placeholder?: string;
}

interface AssetInputConfig extends BaseConfig {
  component: "asset";
  /** Asset kind id, e.g. "images", "videos". */
  kind: string;
  assetsName?: string;
  scope?: Scope;
  jobId?: string;
}

interface AssetStackConfig extends BaseConfig {
  component: "asset-stack";
  /** Asset kind id, e.g. "images", "videos". */
  kind: string;
  assetsName?: string;
  scope?: Scope;
  jobId?: string;
}

// A select listing the machine's video input devices (webcams), bound to a
// deviceId string. "" means the browser's default camera.
interface WebcamDeviceSelectConfig extends BaseConfig {
  component: "webcam-device-select";
}

// A select listing the machine's audio input devices (microphones), bound to a
// deviceId string. "" means the browser's default microphone.
interface AudioInputDeviceSelectConfig extends BaseConfig {
  component: "audio-input-device-select";
}

// A select listing the Web MIDI input devices, bound to an input id string.
// "" means every input is listened to.
interface MidiInputDeviceSelectConfig extends BaseConfig {
  component: "midi-input-device-select";
}

// A select listing the connected gamepads, bound to a gamepad id string.
// "" means any connected gamepad.
interface JoypadDeviceSelectConfig extends BaseConfig {
  component: "joypad-device-select";
}

// Step 3: Create the master Discriminated Union
// This tells TypeScript: "If component is 'select', then it MUST have an 'options' property."
export type FieldConfig =
  | SimpleInputConfig
  | CheckboxInputConfig
  | RangeInputConfig
  | NumberInputConfig
  | ColorInputConfig
  | SelectConfig
  | MultiSelectConfig
  | NestedObjectConfig
  | ConditionalGroupConfig
  | ImagesStackConfig
  | ImageConfig
  | FormatConfig
  | HiddenConfig
  | JsonConfig
  | ItemListConfig
  | HiddenFieldConfig
  | SketchPickerConfig
  | EasingConfig
  | Vector2DConfig
  | SourceSelectConfig
  | KeySelectConfig
  | AssetInputConfig
  | AssetStackConfig
  | WebcamDeviceSelectConfig
  | AudioInputDeviceSelectConfig
  | MidiInputDeviceSelectConfig
  | JoypadDeviceSelectConfig;

// Define the configuration for an entire item type (e.g., 'meta' or 'text')
// The keys of this record must match the field names in the Zod schema
type ItemFormConfig = Record<string, FieldConfig>;

export const fontNames = [
  "martian",
  "loraItalic",
  "loraRegular",
  "spaceMonoItalic",
  "spaceMonoRegular",
  "serif",
  "sans",
  "openSans",
  "tilt",
  "stardom",
  "multicoloure",
  "cloitre",
  "agiro",
  "peix",
  "onlysansVariable",
  "waverseVariable"
];

// Reusable select options derived from the canonical sources above.
// Import these in sketch options.ts files instead of hardcoding arrays.
export const fontSelectOptions: SelectOption[] = fontNames.map( ( fontName ) => ( {
  value: fontName,
  label: fontName
} ) );

// Blend modes come from the `Blend` zod enum (single source of truth in
// sketch.types.ts). This exposes them as ready-to-use select options.
export const blendSelectOptions: SelectOption[] = Blend.options.map( ( blendOption ) => ( {
  value: blendOption,
  label: blendOption
} ) );

/* ---------------- HUD widget field fragments -------------------- */
const hudAnchorField: FieldConfig = {
  label: "Anchor",
  component: "select",
  options: [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
    "center"
  ].map( ( value ) => ( {
    value,
    label: value
  } ) )
};

// Single draggable pad in place of two x/y sliders. Stores the same { x, y }
// shape; yDown keeps screen-space orientation (top of the pad = top of canvas).
const hudOffsetField: FieldConfig = {
  label: "Offset",
  component: "vector2d",
  allowNegative: false,
  min: 0,
  max: 1,
  step: 0.01,
  yDown: true
};

const hudSourceField: FieldConfig = {
  label: "Source",
  component: "source-select"
};

const hudFillField: FieldConfig = {
  label: "Fill",
  component: "color"
};

const hudFontField: FieldConfig = {
  label: "Font",
  component: "select",
  options: fontNames.map( ( fontName ) => ( {
    value: fontName,
    label: fontName
  } ) )
};

const hudBlendField: FieldConfig = {
  label: "Blend",
  component: "select",
  options: Blend.options.map( ( blendOption ) => ( {
    value: blendOption,
    label: blendOption
  } ) )
};

const hudEnabledField: FieldConfig = {
  label: "Enabled",
  component: "checkbox"
};

// Text values the badge can print, in the order picked. Mirrors BADGE_SEGMENTS
// in sketch.types.ts (kept as labelled options here for the picker).
const badgeSegmentOptions: SelectOption[] = [
  {
    value: "resolution",
    label: "Resolution"
  },
  {
    value: "fps",
    label: "FPS"
  },
  {
    value: "resolution-fps",
    label: "Resolution + FPS"
  },
  {
    value: "engine",
    label: "Engine label"
  },
  {
    value: "category",
    label: "Sketch category"
  },
  {
    value: "name",
    label: "Sketch name"
  }
];

const hudLabelField: FieldConfig = {
  label: "Label override",
  component: "text"
};

const hudUnitField: FieldConfig = {
  label: "Unit",
  component: "text"
};

const hudDecimalsField: FieldConfig = {
  label: "Decimals",
  component: "slider",
  min: 0,
  max: 4,
  step: 1
};

const hudSizeField = ( max = 96 ): FieldConfig => ( {
  label: "Size",
  component: "slider",
  min: 8,
  max,
  step: 1
} );

const hudWindowFields: Record<string, FieldConfig> = {
  displayFrom: {
    label: "Display from (0-1)",
    component: "slider",
    min: 0,
    max: 1,
    step: 0.01
  },
  displayTo: {
    label: "Display to (0-1)",
    component: "slider",
    min: 0,
    max: 1,
    step: 0.01
  }
};

const hudRangeFields: Record<string, FieldConfig> = {
  min: {
    label: "Min",
    component: "number"
  },
  max: {
    label: "Max",
    component: "number"
  }
};

// Style every standalone HUD element carries. The boxed elements (badge,
// gauge, sparkline, counter, swatch) add the background-panel trio; the
// full-canvas overlays (crosshairs, bounding box) draw no panel.
const hudElementStyleFields: Record<string, FieldConfig> = {
  fill: hudFillField,
  font: hudFontField,
  blend: hudBlendField
};

const hudBoxStyleFields: Record<string, FieldConfig> = {
  backgroundColor: {
    label: "Background",
    component: "color"
  },
  backgroundStroke: {
    label: "Background stroke",
    component: "color"
  },
  backgroundRadius: {
    label: "Background radius",
    component: "slider",
    min: 0,
    max: 200,
    step: 1
  }
};

const visualSelectOptions = [
  {
    label: "Neon graffiti",
    value: "neon-graffiti",
    config: {}
  },
  {
    label: "Neon line",
    value: "neon-line",
    config: {}
  },
  {
    label: "Neon dot",
    value: "neon-dot",
    config: {}
  },
  {
    label: "Churros snake",
    value: "churros-snake",
    config: {}
  }
];

const gridPatternFields: ItemFormConfig = {
  columns: {
    label: "Columns",
    component: "number",
    step: 1,
    min: 0,
    max: 100
  },
  strokeWeight: {
    label: "Stroke Weight",
    component: "number",
    step: 0.5,
    min: 0,
    max: 100
  },
  stroke: {
    label: "Stroke Color",
    component: "color"
  },
  borders: {
    label: "Borders",
    component: "checkbox"
  }
};

const dotsPatternFields: ItemFormConfig = {
  columns: {
    label: "Columns",
    component: "number",
    step: 1,
    min: 0,
    max: 100
  },
  strokeWeight: {
    label: "Dot weight",
    component: "number",
    step: 0.5,
    min: 0,
    max: 100
  },
  stroke: {
    label: "Stroke Color",
    component: "color"
  },
  borders: {
    label: "Borders",
    component: "checkbox"
  }
};

// Sound-on-change panel, shared by the specs and breakdown items: both narrate
// value changes (specs when a line's value changes, breakdown when a parameter
// locks into place) and drive the same click synth off the same SpecsSoundSchema.
const soundOnChangeField: FieldConfig = {
  label: "Sound on change",
  component: "nested-object",
  fields: {
    enabled: {
      label: "Enabled",
      component: "checkbox"
    },
    preset: {
      label: "Click sound",
      component: "select",
      options: SPECS_SOUND_PRESETS.map( ( presetName ) => ( {
        value: presetName,
        label: presetName
      } ) )
    },
    volume: {
      label: "Volume",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.05
    },
    pitch: {
      label: "Pitch (×)",
      component: "slider",
      min: 0.25,
      max: 4,
      step: 0.05
    },
    pitchVariation: {
      label: "Humanize (random pitch)",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.05
    },
    linePitchSpread: {
      label: "Pitch spread by line (octaves)",
      component: "slider",
      min: -1,
      max: 1,
      step: 0.05
    },
    minInterval: {
      label: "Stagger between clicks (s)",
      component: "slider",
      min: 0,
      max: 0.5,
      step: 0.01
    },
    lineCooldown: {
      label: "Per-line cooldown (s)",
      component: "slider",
      min: 0,
      max: 2,
      step: 0.05
    },
    maxBurst: {
      label: "Max queued clicks",
      component: "slider",
      min: 1,
      max: 32,
      step: 1
    },
    repeat: {
      label: "Repeat",
      component: "conditional-group",
      conditionalOn: "mode",
      hideNone: true,
      typeSelector: {
        label: "Mode",
        options: [
          {
            value: "once",
            label: "Once per change"
          },
          {
            value: "count",
            label: "Burst (N clicks)"
          },
          {
            value: "while-highlighted",
            label: "While highlighted"
          }
        ]
      },
      configs: {
        once: {},
        count: {
          times: {
            label: "Clicks per change",
            component: "slider",
            min: 2,
            max: 16,
            step: 1
          },
          interval: {
            label: "Interval (s)",
            component: "slider",
            min: 0.02,
            max: 2,
            step: 0.01
          },
          pitchStep: {
            label: "Pitch ramp per click (octaves)",
            component: "slider",
            min: -0.5,
            max: 0.5,
            step: 0.01
          }
        },
        "while-highlighted": {
          interval: {
            label: "Interval (s)",
            component: "slider",
            min: 0.02,
            max: 2,
            step: 0.01
          }
        }
      },

      // @ts-expect-error schema carries a .default() wrapper, like VisualOptions
      schema: SpecsSoundRepeatSchema
    }
  }
};

// Main configuration object
// The top-level keys MUST match the 'type' in your Zod discriminated union
export const formConfig: Record<ContentItem[ "type" ], ItemFormConfig> = {
  meta: {
    fill: {
      label: "Fill",
      component: "color"
    },
    stroke: {
      label: "Stroke",
      component: "color"
    },
    blend: {
      label: "Blend",
      component: "select",
      options: blendSelectOptions
    },
    font: {
      label: "font",
      component: "select",
      options: fontSelectOptions
    },
    topLeft: {
      label: "Top left",
      component: "text",
      placeholder: "Text on the top left corner"
    },
    topRight: {
      label: "Top right",
      component: "text",
      placeholder: "Text on the top right corner"
    },
    bottomLeft: {
      label: "Bottom left",
      component: "text",
      placeholder: "Text on the bottom left corner"
    },
    bottomRight: {
      label: "Bottom right",
      component: "text",
      placeholder: "Text on the bottom right corner"
    },
    slideProgression: {
      label: "Slide progression",
      component: "nested-object",
      fields: {
        hidden: {
          label: "Hidden",
          component: "checkbox"
        },
        stroke: {
          label: "Stroke",
          component: "color"
        }
      }
    }
  },
  breakdown: {
    placement: {
      label: "Placement",
      component: "select",
      options: [
        {
          value: "fixed",
          label: "Fixed position"
        },
        {
          value: "roaming",
          label: "Roaming (moves each step)"
        }
      ]
    },
    position: {
      label: "Position (fixed placement only)",
      component: "vector2d",
      allowNegative: false,
      min: 0,
      max: 1,
      step: 0.01,
      yDown: true
    },
    showHeader: {
      label: "Show header row",
      component: "checkbox"
    },
    showCounter: {
      label: "Show step counter",
      component: "checkbox"
    },
    showTitle: {
      label: "Show step title",
      component: "checkbox"
    },
    counterMode: {
      label: "Counter style",
      component: "select",
      options: [
        {
          value: "numeric",
          label: "Numeric (1/3)"
        },
        {
          value: "letters",
          label: "Letters (A, B, C…)"
        }
      ]
    },
    typewriter: {
      label: "Typewriter on labels",
      component: "checkbox"
    },
    valueStyle: {
      label: "Value animation",
      component: "select",
      options: [
        {
          value: "bar",
          label: "Progress bar (gauge)"
        },
        {
          value: "ticker",
          label: "Ticker (live value)"
        },
        {
          value: "roll",
          label: "Roll (odometer)"
        },
        {
          value: "fade",
          label: "Fade"
        },
        {
          value: "rise",
          label: "Rise"
        }
      ]
    },
    fill: {
      label: "Fill",
      component: "color"
    },
    backgroundColor: {
      label: "Background",
      component: "color"
    },
    backgroundStroke: {
      label: "Background stroke",
      component: "color"
    },
    backgroundRadius: {
      label: "Background radius",
      component: "slider",
      min: 0,
      max: 200,
      step: 1
    },
    font: {
      label: "Font",
      component: "select",
      options: fontSelectOptions
    },
    size: {
      label: "Size",
      component: "slider",
      min: 8,
      max: 96,
      step: 1
    },
    lineHeight: {
      label: "Line height",
      component: "slider",
      min: 1,
      max: 3,
      step: 0.05
    },
    blend: {
      label: "Blend",
      component: "select",
      options: blendSelectOptions
    },
    sound: soundOnChangeField,
    build: {
      label: "Breakdown engine",
      component: "nested-object",
      initialExpanded: true,
      fields: {
        selection: {
          label: "Steps",
          component: "select",
          options: [
            {
              value: "changed",
              label: "Changed parameters only (diff vs defaults)"
            },
            {
              value: "all",
              label: "All parameters"
            }
          ]
        },
        departure: {
          label: "Departure (how far values start)",
          component: "slider",
          min: 0,
          max: 1,
          step: 0.05
        },
        introRatio: {
          label: "Intro span (loop fraction)",
          component: "slider",
          min: 0,
          max: 0.3,
          step: 0.01
        },
        outroRatio: {
          label: "Outro span (loop fraction)",
          component: "slider",
          min: 0,
          max: 0.4,
          step: 0.01
        },
        holdRatio: {
          label: "Hold after lock (per step)",
          component: "slider",
          min: 0,
          max: 0.9,
          step: 0.01
        },
        easing: {
          label: "Step easing",
          component: "easing"
        },
        lineStagger: {
          label: "Line stagger (0 = together)",
          component: "slider",
          min: 0,
          max: 1,
          step: 0.05
        },
        snapKeys: {
          label: "Snap keys (no lerp)",
          component: "item-list",
          itemConfig: {
            label: "Key",
            component: "key-select",
            placeholder: "Pick a key or group…"
          }
        },
        excludeKeys: {
          label: "Excluded keys (never animated)",
          component: "item-list",
          itemConfig: {
            label: "Key",
            component: "key-select",
            placeholder: "Pick a key or group…"
          }
        }
      }
    }
  },
  specs: {
    style: {
      label: "Style",
      component: "select",
      options: [
        {
          value: "boot-log",
          label: "Boot log"
        },
        {
          value: "ticker",
          label: "Ticker"
        }
      ]
    },
    fill: {
      label: "Fill",
      component: "color"
    },
    backgroundColor: {
      label: "Background",
      component: "color"
    },
    backgroundStroke: {
      label: "Background stroke",
      component: "color"
    },
    backgroundRadius: {
      label: "Background radius",
      component: "slider",
      min: 0,
      max: 200,
      step: 1
    },
    font: {
      label: "Font",
      component: "select",
      options: fontSelectOptions
    },
    size: {
      label: "Size",
      component: "slider",
      min: 8,
      max: 96,
      step: 1
    },
    lineHeight: {
      label: "Line height",
      component: "slider",
      min: 1,
      max: 3,
      step: 0.05
    },
    blend: {
      label: "Blend",
      component: "select",
      options: blendSelectOptions
    },
    showCursor: {
      label: "Blinking cursor",
      component: "checkbox"
    },
    content: {
      label: "Content",
      component: "multi-select",
      options: [
        {
          value: "general",
          label: "General options"
        },
        {
          value: "sketch",
          label: "Sketch options"
        }
      ]
    },
    position: {
      label: "Position",
      component: "vector2d",
      allowNegative: false,
      min: 0,
      max: 1,
      step: 0.01,
      yDown: true
    },
    visibility: {
      label: "Visibility",
      component: "conditional-group",
      conditionalOn: "mode",
      hideNone: true,
      typeSelector: {
        label: "Mode",
        options: [
          {
            value: "fade",
            label: "Fade (boot + disappear)"
          },
          {
            value: "permanent",
            label: "Permanent"
          }
        ]
      },
      configs: {
        fade: {
          revealEnd: {
            label: "Reveal end",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          },
          holdEnd: {
            label: "Hold end",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          },
          fadeEnd: {
            label: "Fade end",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          }
        },
        permanent: {}
      },

      // @ts-expect-error schema carries a .default() wrapper, like VisualOptions
      schema: SpecsVisibilitySchema
    },
    highlight: {
      label: "Highlight on change",
      component: "conditional-group",
      conditionalOn: "style",
      hideNone: true,
      typeSelector: {
        label: "Effect",
        options: [
          {
            value: "off",
            label: "Off"
          },
          {
            value: "invert",
            label: "Inverted bar (NGE)"
          },
          {
            value: "pulse",
            label: "Pulse / glow"
          },
          {
            value: "pastille",
            label: "Pastille / marker"
          },
          {
            value: "underline",
            label: "Underline"
          },
          {
            value: "blink",
            label: "Blink"
          }
        ]
      },
      configs: {
        off: {},
        invert: {
          duration: {
            label: "Duration (s)",
            component: "slider",
            min: 0.1,
            max: 5,
            step: 0.1
          },
          background: {
            label: "Inverted bar color",
            component: "color"
          }
        },
        pulse: {
          duration: {
            label: "Duration (s)",
            component: "slider",
            min: 0.1,
            max: 5,
            step: 0.1
          }
        },
        pastille: {
          duration: {
            label: "Duration (s)",
            component: "slider",
            min: 0.1,
            max: 5,
            step: 0.1
          },
          pastilleOffset: {
            label: "Pastille offset",
            component: "slider",
            min: -1,
            max: 1,
            step: 0.01
          }
        },
        underline: {
          duration: {
            label: "Duration (s)",
            component: "slider",
            min: 0.1,
            max: 5,
            step: 0.1
          },
          underlineOffset: {
            label: "Underline offset",
            component: "slider",
            min: -1,
            max: 1,
            step: 0.01
          }
        },
        blink: {
          duration: {
            label: "Duration (s)",
            component: "slider",
            min: 0.1,
            max: 3,
            step: 0.1
          },
          frequency: {
            label: "Frequency (Hz)",
            component: "slider",
            min: 1,
            max: 20,
            step: 0.5
          },
          background: {
            label: "Inverted bar color",
            component: "color"
          }
        }
      },

      // @ts-expect-error schema carries a .default() wrapper, like VisualOptions
      schema: SpecsHighlightSchema
    },
    sound: soundOnChangeField
  },
  "hud-badge": {
    enabled: hudEnabledField,
    // Drag-reorderable list of text values. Each item is a picker over the
    // available tokens; the element prints them in order, "·"-separated.
    segments: {
      label: "Segments",
      component: "item-list",
      itemConfig: {
        label: "Value",
        component: "select",
        options: badgeSegmentOptions
      }
    },
    override: {
      label: "Override text",
      component: "text",
      placeholder: "Replaces the whole badge when set"
    },
    anchor: hudAnchorField,
    offset: hudOffsetField,
    size: hudSizeField(),
    ...hudElementStyleFields,
    ...hudBoxStyleFields
  },
  "hud-gauge": {
    enabled: hudEnabledField,
    source: hudSourceField,
    anchor: hudAnchorField,
    offset: hudOffsetField,
    size: hudSizeField( 48 ),
    ...hudRangeFields,
    label: hudLabelField,
    unit: hudUnitField,
    decimals: hudDecimalsField,
    easingFn: {
      label: "Fill easing",
      component: "easing"
    },
    ...hudWindowFields,
    ...hudElementStyleFields,
    ...hudBoxStyleFields
  },
  "hud-sparkline": {
    enabled: hudEnabledField,
    source: hudSourceField,
    anchor: hudAnchorField,
    offset: hudOffsetField,
    size: hudSizeField( 48 ),
    ...hudRangeFields,
    historySize: {
      label: "History points",
      component: "slider",
      min: 8,
      max: 180,
      step: 1
    },
    decimals: hudDecimalsField,
    unit: hudUnitField,
    ...hudWindowFields,
    ...hudElementStyleFields,
    ...hudBoxStyleFields
  },
  "hud-counter": {
    enabled: hudEnabledField,
    source: hudSourceField,
    anchor: hudAnchorField,
    offset: hudOffsetField,
    size: hudSizeField( 160 ),
    label: hudLabelField,
    unit: hudUnitField,
    decimals: hudDecimalsField,
    ...hudWindowFields,
    ...hudElementStyleFields,
    ...hudBoxStyleFields
  },
  "hud-crosshairs": {
    enabled: hudEnabledField,
    source: hudSourceField,
    size: hudSizeField( 48 ),
    ...hudWindowFields,
    ...hudElementStyleFields
  },
  "hud-swatch": {
    enabled: hudEnabledField,
    source: hudSourceField,
    anchor: hudAnchorField,
    offset: hudOffsetField,
    size: hudSizeField( 48 ),
    label: hudLabelField,
    ...hudWindowFields,
    ...hudElementStyleFields,
    ...hudBoxStyleFields
  },
  "hud-bounding-box": {
    enabled: hudEnabledField,
    source: hudSourceField,
    size: hudSizeField( 48 ),
    region: {
      label: "Region (0-1)",
      component: "nested-object",
      fields: {
        x: {
          label: "x",
          component: "slider",
          min: 0,
          max: 1,
          step: 0.01
        },
        y: {
          label: "y",
          component: "slider",
          min: 0,
          max: 1,
          step: 0.01
        },
        w: {
          label: "w",
          component: "slider",
          min: 0,
          max: 1,
          step: 0.01
        },
        h: {
          label: "h",
          component: "slider",
          min: 0,
          max: 1,
          step: 0.01
        }
      }
    },
    label: hudLabelField,
    ...hudWindowFields,
    ...hudElementStyleFields
  },
  text: {
    content: {
      label: "Content",
      component: "textarea"
    },
    size: {
      label: "Size",
      component: "slider",
      step: 1,
      min: 1,
      max: 1024
    },
    fill: {
      label: "Fill",
      component: "color"
    },
    stroke: {
      label: "Stroke",
      component: "color"
    },
    font: {
      label: "font",
      component: "select",
      options: fontSelectOptions
    },
    strokeWeight: {
      label: "Stroke weight",
      component: "slider",
      min: 0,
      max: 20,
      step: 0.5
    },
    position: {
      label: "Position",
      component: "vector2d",
      allowNegative: false,
      min: 0,
      max: 1,
      step: 0.01,
      yDown: true
    },
    alignment: {
      label: "Alignment",
      component: "nested-object",
      fields: {
        horizontal: {
          label: "Horizontal alignment",
          component: "select",
          options: HorizontalAlign.options.map( ( horizontalAlignOption ) => ( {
            value: horizontalAlignOption,
            label: horizontalAlignOption
          } ) )
        },
        vertical: {
          label: "Vertical alignment",
          component: "select",
          options: VerticalAlign.options.map( ( verticalAlignOption ) => ( {
            value: verticalAlignOption,
            label: verticalAlignOption
          } ) )
        }
      }
    },
    margin: {
      label: "Margin",
      component: "nested-object",
      fields: {
        horizonta: {
          label: "Horizontal",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        },
        vertical: {
          label: "Vertical",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        }
      }
    },
    blend: {
      label: "Blend",
      component: "select",
      options: blendSelectOptions
    }
    // We can add more fields here and they will auto-generate
  },
  title: {
    content: {
      label: "Content",
      component: "textarea"
    },
    size: {
      label: "Size",
      component: "slider",
      step: 1,
      min: 1,
      max: 1024
    },
    fill: {
      label: "Fill",
      component: "color"
    },
    stroke: {
      label: "Stroke",
      component: "color"
    },
    strokeWeight: {
      label: "Stroke weight",
      component: "slider",
      min: 0,
      max: 20,
      step: 0.5
    },
    font: {
      label: "Font",
      component: "select",
      options: fontSelectOptions
    },
    position: {
      label: "Position",
      component: "vector2d",
      allowNegative: false,
      min: 0,
      max: 1,
      step: 0.01,
      yDown: true
    },
    alignment: {
      label: "Alignment",
      component: "nested-object",
      fields: {
        horizontal: {
          label: "Horizontal alignment",
          component: "select",
          options: HorizontalAlign.options.map( ( horizontalAlignOption ) => ( {
            value: horizontalAlignOption,
            label: horizontalAlignOption
          } ) )
        },
        vertical: {
          label: "Vertical alignment",
          component: "select",
          options: VerticalAlign.options.map( ( verticalAlignOption ) => ( {
            value: verticalAlignOption,
            label: verticalAlignOption
          } ) )
        }
      }
    },
    margin: {
      label: "Margin",
      component: "nested-object",
      fields: {
        horizontal: {
          label: "Horizontal",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        },
        vertical: {
          label: "Vertical",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        }
      }
    },
    blend: {
      label: "Blend",
      component: "select",
      options: blendSelectOptions
    },
    displayFrom: {
      label: "Display from (0-1)",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.01
    },
    displayTo: {
      label: "Display to (0-1)",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.01
    }
  },
  background: {
    background: {
      label: "Background color",
      component: "color"
    },
    // THIS IS THE NEW PART
    pattern: {
      label: "Pattern",
      component: "conditional-group", // Use our new component type
      conditionalOn: "type", // The field inside 'pattern' to watch

      // The field used to pick the type. The renderer will create this.
      typeSelector: {
        options: [
          {
            value: "grid",
            label: "Grid"
          },
          {
            value: "dots",
            label: "Dots"
          }
        ]
      },

      // A map of which config to use for each 'type'
      configs: {
        grid: gridPatternFields,
        dots: dotsPatternFields
      },

      // The schema is needed to create default objects when the type changes
      // @ts-expect-error
      schema: PatternSchema
    }
  },
  image: {
    source: {
      label: "Source",
      component: "image"
    },
    margin: {
      label: "Margin",
      component: "slider",
      step: 1,
      min: 0,
      max: 1000
    },
    center: {
      label: "Center",
      component: "checkbox"
    },
    scale: {
      label: "Scale",
      component: "slider",
      step: 0.1,
      min: 0.1,
      max: 6
    },
    position: {
      label: "Position",
      component: "vector2d",
      allowNegative: false,
      min: 0,
      max: 1,
      step: 0.01,
      yDown: true
    },
    animation: {
      label: "Animation",
      component: "conditional-group",
      conditionalOn: "name",
      typeSelector: {
        options: [
          {
            label: "Noise floating",
            value: "noise-floating"
          }
        ]
      },
      configs: {
        "noise-floating": {
          amplitude: {
            label: "Amplitude",
            component: "slider",
            step: 1,
            min: 0,
            max: 512
          },
          noiseDetail: {
            label: "Noise detail",
            component: "nested-object",
            fields: {
              0: {
                label: "lod",
                component: "slider",
                step: 0.1,
                min: 0,
                max: 8
              },
              1: {
                label: "falloff",
                component: "slider",
                step: 0.1,
                min: 0,
                max: 1
              }
            }
          }
        }
      },

      schema: ImageItemAnimations
    }
  },
  "images-stack": {
    sources: {
      label: "Sources",
      component: "images-stack"
    },
    margin: {
      label: "Margin",
      component: "number"
    },
    scale: {
      label: "Scale",
      component: "slider",
      step: 0.1,
      min: 0.1,
      max: 6
    },
    position: {
      label: "Position",
      component: "vector2d",
      allowNegative: false,
      min: 0,
      max: 1,
      step: 0.01,
      yDown: true
    },
    rotation: {
      label: "Rotation",
      component: "slider",
      min: 0,
      max: Math.PI * 2,
      step: 0.001
    },
    center: {
      label: "Center",
      component: "checkbox"
    },
    progressiveRotation: {
      label: "Progressive rotation",
      component: "slider",
      min: 0,
      max: Math.PI * 2,
      step: 0.001
    },
    animation: {
      label: "Animation",
      component: "conditional-group",
      conditionalOn: "name",
      typeSelector: {
        options: [
          {
            label: "Display on/off",
            value: "random"
          }
        ]
      },
      configs: {
        random: {
          shift: {
            label: "Shift",
            component: "number",
            step: 1,
            min: 1,
            max: 30
          }
        }
      },

      schema: ImagesStackAnimations
    }
  },
  visual: {
    position: {
      label: "Position",
      component: "vector2d",
      allowNegative: false,
      min: 0,
      max: 1,
      step: 0.01,
      yDown: true
    },
    scale: {
      label: "Scale",
      component: "slider",
      min: -10,
      max: 10,
      step: 0.01
    },
    rotation: {
      label: "Rotation",
      component: "slider",
      min: 0,
      max: Math.PI * 2,
      step: 0.001
    },
    visual: {
      component: "conditional-group",
      conditionalOn: "name",
      typeSelector: {
        options: visualSelectOptions.map( ( {
          value, label
        } ) => ( {
          value,
          label
        } ) )
      },
      configs: visualSelectOptions.reduce(
        (
          finalConfigs, visualSelectOption
        ) => {
          finalConfigs[ visualSelectOption.value ] = visualSelectOption.config;

          return finalConfigs;
        },
        {} as ConditionalGroupConfig[ "configs" ]
      ),

      // @ts-expect-error
      schema: VisualOptions
    }
  },
  // The embedded-sketch layer. `settings` is deliberately absent from this
  // table: the embedded sketch's own parameters have no fixed shape, so
  // GenericItemForm renders them from that sketch's `formConfiguration`,
  // fetched for whichever sketch the layer currently runs.
  sketch: {
    sketch: {
      label: "Sketch",
      component: "sketch-picker"
    },
    enabled: {
      label: "Visible",
      component: "checkbox"
    },
    position: {
      label: "Position",
      component: "vector2d",
      allowNegative: false,
      min: 0,
      max: 1,
      step: 0.01,
      yDown: true
    },
    scale: {
      label: "Size",
      component: "slider",
      min: 0.05,
      max: 4,
      step: 0.01
    },
    aspectRatio: {
      label: "Aspect ratio",
      component: "select",
      options: [
        {
          value: "canvas",
          label: "Follow the canvas"
        },
        {
          value: "1:1",
          label: "1:1 — square"
        },
        {
          value: "4:5",
          label: "4:5 — portrait"
        },
        {
          value: "3:4",
          label: "3:4"
        },
        {
          value: "2:3",
          label: "2:3"
        },
        {
          value: "9:16",
          label: "9:16 — story"
        },
        {
          value: "3:2",
          label: "3:2"
        },
        {
          value: "4:3",
          label: "4:3"
        },
        {
          value: "16:9",
          label: "16:9 — wide"
        }
      ]
    },
    rotation: {
      label: "Rotation",
      component: "slider",
      min: 0,
      max: Math.PI * 2,
      step: 0.001
    },
    opacity: {
      label: "Opacity",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.01
    },
    blend: {
      label: "Blend",
      component: "select",
      options: blendSelectOptions
    },
    resolution: {
      label: "Render resolution",
      component: "slider",
      min: 0.05,
      max: 2,
      step: 0.05
    },
    framerate: {
      label: "Frame rate (0 = follow)",
      component: "slider",
      min: 0,
      max: 120,
      step: 1
    },
    drawBackground: {
      label: "Draw its own background",
      component: "checkbox"
    },
    clearEachFrame: {
      label: "Clear between frames",
      component: "checkbox"
    }
  },
  qrcode: {
    domainOverride: {
      label: "Domain override",
      component: "text",
      placeholder: "e.g. mysite.com — empty uses NEXT_PUBLIC_SITE_URL"
    },
    size: {
      label: "Size",
      component: "slider",
      min: 0.02,
      max: 1,
      step: 0.01
    },
    position: {
      label: "Position",
      component: "vector2d",
      allowNegative: false,
      min: 0,
      max: 1,
      step: 0.01,
      yDown: true
    },
    errorCorrection: {
      label: "Error correction",
      component: "select",
      options: [
        {
          value: "L",
          label: "L — Low (7%)"
        },
        {
          value: "M",
          label: "M — Medium (15%)"
        },
        {
          value: "Q",
          label: "Q — Quartile (25%)"
        },
        {
          value: "H",
          label: "H — High (30%)"
        }
      ]
    },
    quietZone: {
      label: "Quiet zone",
      component: "slider",
      min: 0,
      max: 8,
      step: 1
    },
    foreground: {
      label: "Foreground",
      component: "color"
    },
    background: {
      label: "Background",
      component: "color"
    },
    blend: {
      label: "Blend",
      component: "select",
      options: blendSelectOptions
    },
    showUrl: {
      label: "Show URL caption",
      component: "checkbox"
    },
    urlFont: {
      label: "URL font",
      component: "select",
      options: fontSelectOptions
    },
    urlSize: {
      label: "URL size",
      component: "slider",
      min: 6,
      max: 96,
      step: 1
    },
    urlFill: {
      label: "URL color",
      component: "color"
    }
  }
};
