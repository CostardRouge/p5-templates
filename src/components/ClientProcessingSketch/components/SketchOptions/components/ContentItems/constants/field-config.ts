import type {
  ZodType
} from "zod";
import {
  Blend,
  type ContentItem,
  HorizontalAlign,
  ImageItemAnimations,
  ImagesStackAnimations,
  PatternSchema,
  SEQUENCE_CAMERA_MOVES,
  SEQUENCE_CUBE_AXES,
  SEQUENCE_IRIS_SHAPES,
  SEQUENCE_LOADER_STYLES,
  SEQUENCE_LOOP_MODES,
  SEQUENCE_PALETTE_OWN,
  SEQUENCE_PLATE_GRADIENTS,
  SEQUENCE_PUSH_MODES,
  SEQUENCE_SPLASH_ACCENTS,
  SEQUENCE_SPLASH_ANIMATIONS,
  SEQUENCE_TILE_MOTIONS,
  SEQUENCE_TRANSITION_KINDS,
  SEQUENCE_ZOOM_DIRECTIONS,
  SPECS_SOUND_PRESETS,
  SequenceEffectSchema,
  SequenceSceneSchema,
  SlideTransitionSoundRepeatSchema,
  SpecsHighlightSchema,
  SpecsSoundRepeatSchema,
  SpecsVisibilitySchema,
  VerticalAlign
} from "@/types/sketch.types";
import {
  PALETTE_PRESET_OPTIONS
} from "@/p5/utils/palettes.js";

import type {
  InactiveUnless
} from "../../../utils/resolveRelativePath";

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
  /**
   * Grey this field out (and make it inert) while another field does not hold
   * a given value — for a control whose value something else overrides, like
   * the colour stops a palette preset replaces. `field` is relative to this
   * field's parent (`"palette"` for a sibling, `"material/ramp/palette"` from `sketch.background`).
   */
  inactiveUnless?: InactiveUnless;
  /**
   * A control this field follows by default, declared by the sketch rather than
   * authored by the user: `binding: { control: "knob.1" }`.
   *
   * `control` is an ABSTRACT address — it names no device, no port and no CC
   * number, so the same vocabulary can later address a gamepad axis
   * (`axis.left-x`), an audio band (`band.bass`) or a generator (`lfo`). What it
   * resolves to depends on which controller is plugged in, which is why the
   * sketch must not spell it out: see `@/p5/utils/interaction/controllerMap`.
   *
   * Resolved at read time and never written to the document, so a field keeps
   * working as an ordinary control when no controller is connected.
   */
  binding?: {
    control: string;
  };
  /**
   * Show the field only while a sibling field of the same content item holds
   * one of these values — the Vector 3D element's spin, which means something
   * only in the two views that have a camera. Hiding never clears the value,
   * so switching back finds it where it was. Read by GenericItemForm.
   */
  visibleWhen?: {
    field: string;
    in: readonly unknown[];
  };
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

// A sketch's background (utils/backgroundSpec.js): a colour, or a two-colour
// gradient — linear or radial — with strength, easing and a motion over the
// loop. The stored value stays a colour array until the kind is changed, so a
// field switched from "color" to "background" changes nothing saved.
export interface BackgroundConfig extends BaseConfig {
  component: "background";
  /**
   * The sketch's palette id field, relative to this field's parent (as the
   * palette picker's `custom` paths are). When set, the colours can come from
   * that palette's paper instead of the field's own.
   */
  palette?: string;
  /**
   * The keys that hold the two colours, when the stored value does not call
   * them `from` and `to` (the iridescent family's paper is `top` / `bottom`,
   * which the palette picker also writes).
   */
  colors?: {
    from?: string;
    to?: string;
  };
  /**
   * Every id of the `palette` field is a shared preset, so a colors.js
   * function of the same name (`rainbow`) still brings its paper.
   */
  presetsOnly?: boolean;
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
  // Any schema whose `parse( { [conditionalOn]: type } )` fills a whole
  // variant: a discriminated union, with or without its own `.default()`.
  schema?: ZodType;
  // When true, omit the empty "--" (None) option from the selector. Use it for
  // required discriminators that should always resolve to a concrete variant.
  hideNone?: boolean;
  // Name the selected variant in the collapsed header ("Scene · Splash"), for
  // a group that sits in a list where every row would otherwise read alike.
  headerShowsValue?: boolean;
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

// The embedded sketch's own parameters, rendered from that sketch's
// formConfiguration against the sibling `settings` of the `sketch` path the
// picker writes (EmbeddedSketchFields). The "sketch" item renders it by name;
// a sequence's sketch scene declares it, so the scene's form shows the same
// controls the layer's does.
interface SketchSettingsConfig extends BaseConfig {
  component: "sketch-settings";
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

// For 3D vector inputs: three number fields over an orbitable 3D box that
// edits one { x, y, z } at once — drag the arrow's tip, Shift for depth, hold
// an axis letter to slide along it. Same range ladder as the 2D pad, extended
// to z; the stored shape is always cartesian.
export interface Vector3DConfig extends BaseConfig {
  component: "vector3d";
  /** Defaults to true: a centred [min, max] box. False → [0, max] on every axis. */
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
  zAxis?: {
    min?: number;
    max?: number;
    step?: number;
  };
  /**
   * Draw +y downward, as p5's WEBGL canvas does (Three.js has +y up). Rendering
   * only — the stored value is the same either way.
   */
  yDown?: boolean;
  /**
   * What the triple means. A "position" (the default) gets the floor and the
   * dropped shadow that make depth readable; a "direction" skips them, since
   * a direction has no place to stand.
   */
  kind?: "position" | "direction";
}

// A named colour look, as the palette picker draws it: the ramp's stops and
// its band hardness as a swatch, on the `paper` behind it. An option without
// stops stands for "the stops the form holds" (the picker draws those live).
export type PaletteOption = {
  value: string;
  label: string;
  /** A longer line, shown as the tile's tooltip. */
  description?: string;
  /** Tiles are grouped under this heading, in first-seen order. */
  group?: string;
  stops?: number[][];
  hardness?: number;
  paper?: {
    top?: number[];
    bottom?: number[];
  };
};

// A palette chooser: a bar showing the current look's swatch, unfolding into a
// grid of swatch tiles. The stored value is the option's `value`, like a
// select; a select of thirteen palette NAMES was the first build, and nobody
// picks a look from its name.
export interface PalettePickerConfig extends BaseConfig {
  component: "palette-picker";
  options: PaletteOption[];
  /**
   * Where the hand-made look lives, as paths relative to the field's parent
   * object (`"stops"` is a sibling, `"../../background"` climbs two levels).
   * The option `customValue` is drawn from these live, and "edit a copy"
   * writes a preset into them before switching to it.
   */
  custom?: {
    value?: string;
    stops?: string;
    hardness?: string;
    paper?: string;
  };
}

// Source picker for HUD widgets: options are derived at render time from the
// live sketch settings + built-in keys (see ControlledSourceSelect).
interface SourceSelectConfig extends BaseConfig {
  component: "source-select";
  /**
   * Which value shape the widget consumes, which decides what the picker
   * lists. "scalar" (the default) offers every scalar key-path plus the live
   * built-ins; "point" offers only the `{ x, y }` key-paths and the point
   * built-ins — a crosshair or a vector map bound to a number draws nothing,
   * so offering numbers there is offering a dead end. "triple" offers the
   * `{ x, y, z }` key-paths, for the Vector 3D element.
   */
  kind?: "scalar" | "point" | "triple";
}

// The Vector 3D element's view picker: five live tiles, each drawing the
// element's own value in that view (ControlledVector3DViewPicker). Reads its
// sibling fields (source, kind, domain, yDown), so it only makes sense inside
// a hud-vector3d item.
interface Vector3DViewConfig extends BaseConfig {
  component: "vector3d-view";
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
  | BackgroundConfig
  | SelectConfig
  | PalettePickerConfig
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
  | SketchSettingsConfig
  | EasingConfig
  | Vector2DConfig
  | Vector3DConfig
  | SourceSelectConfig
  | Vector3DViewConfig
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

// Source picker restricted to the point-valued sources (the sketch's vector
// parameters, plus mouse / center) — for the widgets that plot a position.
const hudPointSourceField: FieldConfig = {
  label: "Source",
  component: "source-select",
  kind: "point"
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

      schema: SpecsSoundRepeatSchema
    }
  }
};

// Main configuration object
// The top-level keys MUST match the 'type' in your Zod discriminated union
/* ---------------- shared layer / sequence fragments ------------------ */

// Layer box shapes beside "follow the host canvas" (SketchLayerAspectRatio),
// shared by the sketch layer and the sequence.
const layerAspectRatioOptions: SelectOption[] = [
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
];

const titleCase = ( value: string ) => value.charAt( 0 ).toUpperCase() + value.slice( 1 ).replaceAll(
  "-",
  " "
);

const enumOptions = (
  values: readonly string[], labels: Record<string, string> = {}
): SelectOption[] => values.map( ( value ) => ( {
  value,
  label: labels[ value ] ?? titleCase( value )
} ) );

// Where a transition's or a plate's colours come from: the item's own colour
// fields, drawn as a neutral tile since the picker cannot show a single
// colour live, then every shared palette by its swatch.
const sequencePaletteOptions: PaletteOption[] = [
  {
    value: SEQUENCE_PALETTE_OWN,
    label: "Own colours",
    group: "Your own",
    description: "The colour fields of this block",
    stops: [
      [
        70,
        70,
        82
      ],
      [
        70,
        70,
        82
      ]
    ],
    hardness: 0
  },
  // The presets are plain JS records (palettes.js); every one carries a label,
  // a group and its swatch stops, which is all a PaletteOption asks for.
  ...( PALETTE_PRESET_OPTIONS as unknown as PaletteOption[] )
];

const unitSlider = ( label: string ): FieldConfig => ( {
  label,
  component: "slider",
  min: 0,
  max: 1,
  step: 0.01
} );

const angleSlider = ( label: string ): FieldConfig => ( {
  label,
  component: "slider",
  min: 0,
  max: 360,
  step: 1
} );

const effectCenterField: FieldConfig = {
  label: "Centre",
  component: "vector2d",
  allowNegative: false,
  min: 0,
  max: 1,
  step: 0.01,
  yDown: true,
  default: {
    x: 0.5,
    y: 0.5
  }
};

const effectSeedField: FieldConfig = {
  label: "Seed",
  component: "slider",
  min: 0,
  max: 9999,
  step: 1
};

export const SEQUENCE_TRANSITION_LABELS: Record<string, string> = {
  cut: "Cut",
  fade: "Crossfade",
  dip: "Dip through colour",
  flash: "Flash",
  wipe: "Wipe",
  iris: "Iris",
  push: "Push / slide",
  zoom: "Zoom punch",
  dissolve: "Dissolve",
  pixelate: "Pixelate",
  glitch: "Glitch",
  blinds: "Blinds",
  tiles: "Tiles",
  radial: "Clock wipe",
  ripple: "Ripple",
  swirl: "Swirl",
  cube: "Cube",
  doom: "Melt",
  burn: "Film burn",
  luma: "Luma wipe",
  slice: "Slices"
};

// One branch per transition kind, carrying only the parameters it reads
// (transitionGlsl.js effectUniforms). Every field carries a `default` so a
// kind switch rebuilds the object with sensible values.
const sequenceEffectConfigs: Record<string, Record<string, FieldConfig>> = {
  cut: {},
  fade: {},
  dip: {},
  flash: {
    intensity: {
      ...unitSlider( "Intensity" ),
      default: 0.85
    }
  },
  wipe: {
    angle: {
      ...angleSlider( "Direction (°)" ),
      default: 0
    },
    softness: {
      ...unitSlider( "Softness" ),
      default: 0.08
    }
  },
  iris: {
    shape: {
      label: "Shape",
      component: "select",
      options: enumOptions( SEQUENCE_IRIS_SHAPES ),
      default: "circle"
    },
    center: effectCenterField,
    softness: {
      ...unitSlider( "Softness" ),
      default: 0.05
    }
  },
  push: {
    angle: {
      ...angleSlider( "Direction (°)" ),
      default: 0
    },
    mode: {
      label: "Motion",
      component: "select",
      options: enumOptions(
        SEQUENCE_PUSH_MODES,
        {
          push: "Push (both move)",
          cover: "Cover (new slides over)",
          reveal: "Reveal (old slides away)"
        }
      ),
      default: "push"
    }
  },
  zoom: {
    direction: {
      label: "Direction",
      component: "select",
      options: enumOptions(
        SEQUENCE_ZOOM_DIRECTIONS,
        {
          in: "Punch in",
          out: "Pull out"
        }
      ),
      default: "in"
    },
    amount: {
      ...unitSlider( "Amount" ),
      default: 0.6
    },
    center: effectCenterField
  },
  dissolve: {
    scale: {
      label: "Noise scale",
      component: "slider",
      min: 1,
      max: 64,
      step: 1,
      default: 8
    },
    softness: {
      ...unitSlider( "Softness" ),
      default: 0.15
    },
    seed: {
      ...effectSeedField,
      default: 7
    }
  },
  pixelate: {
    cells: {
      label: "Coarsest cells",
      component: "slider",
      min: 2,
      max: 200,
      step: 1,
      default: 24
    }
  },
  glitch: {
    intensity: {
      ...unitSlider( "Intensity" ),
      default: 0.7
    },
    blocks: {
      label: "Blocks",
      component: "slider",
      min: 2,
      max: 64,
      step: 1,
      default: 12
    },
    seed: {
      ...effectSeedField,
      default: 7
    }
  },
  blinds: {
    count: {
      label: "Blinds",
      component: "slider",
      min: 1,
      max: 64,
      step: 1,
      default: 8
    },
    angle: {
      ...angleSlider( "Direction (°)" ),
      default: 90
    },
    softness: {
      ...unitSlider( "Softness" ),
      default: 0.05
    }
  },
  tiles: {
    columns: {
      label: "Columns",
      component: "slider",
      min: 1,
      max: 32,
      step: 1,
      default: 6
    },
    rows: {
      label: "Rows",
      component: "slider",
      min: 1,
      max: 32,
      step: 1,
      default: 8
    },
    stagger: {
      ...unitSlider( "Stagger" ),
      default: 0.6
    },
    motion: {
      label: "Motion",
      component: "select",
      options: enumOptions( SEQUENCE_TILE_MOTIONS ),
      default: "flip"
    },
    seed: {
      ...effectSeedField,
      default: 7
    }
  },
  radial: {
    center: effectCenterField,
    softness: {
      ...unitSlider( "Softness" ),
      default: 0.04
    },
    clockwise: {
      label: "Clockwise",
      component: "checkbox",
      default: true
    },
    startAngle: {
      ...angleSlider( "Start angle (°)" ),
      default: 0
    }
  },
  ripple: {
    rings: {
      label: "Rings",
      component: "slider",
      min: 1,
      max: 40,
      step: 1,
      default: 10
    },
    amplitude: {
      ...unitSlider( "Amplitude" ),
      default: 0.3
    },
    center: effectCenterField
  },
  swirl: {
    strength: {
      label: "Strength (turns)",
      component: "slider",
      min: -3,
      max: 3,
      step: 0.05,
      default: 1.5
    },
    center: effectCenterField
  },
  cube: {
    axis: {
      label: "Axis",
      component: "select",
      options: enumOptions( SEQUENCE_CUBE_AXES ),
      default: "horizontal"
    },
    perspective: {
      ...unitSlider( "Perspective" ),
      default: 0.4
    }
  },
  doom: {
    columns: {
      label: "Columns",
      component: "slider",
      min: 2,
      max: 200,
      step: 1,
      default: 40
    },
    seed: {
      ...effectSeedField,
      default: 7
    }
  },
  burn: {
    scale: {
      label: "Noise scale",
      component: "slider",
      min: 1,
      max: 64,
      step: 1,
      default: 6
    },
    softness: {
      ...unitSlider( "Softness" ),
      default: 0.25
    },
    seed: {
      ...effectSeedField,
      default: 7
    }
  },
  luma: {
    softness: {
      ...unitSlider( "Softness" ),
      default: 0.1
    },
    invert: {
      label: "Dark areas first",
      component: "checkbox",
      default: false
    }
  },
  slice: {
    count: {
      label: "Slices",
      component: "slider",
      min: 2,
      max: 64,
      step: 1,
      default: 10
    },
    angle: {
      ...angleSlider( "Direction (°)" ),
      default: 0
    },
    stagger: {
      ...unitSlider( "Stagger" ),
      default: 0.5
    }
  }
};

const sequenceTransitionField: FieldConfig = {
  label: "Transition in",
  component: "nested-object",
  initialExpanded: true,
  fields: {
    duration: {
      label: "Duration (s)",
      component: "slider",
      min: 0,
      max: 10,
      step: 0.05
    },
    easing: {
      label: "Easing",
      component: "easing"
    },
    effect: {
      label: "Effect",
      component: "conditional-group",
      conditionalOn: "kind",
      hideNone: true,
      headerShowsValue: true,
      schema: SequenceEffectSchema,
      typeSelector: {
        label: "Kind",
        options: enumOptions(
          SEQUENCE_TRANSITION_KINDS,
          SEQUENCE_TRANSITION_LABELS
        )
      },
      configs: sequenceEffectConfigs
    },
    color: {
      label: "Colour",
      component: "color"
    },
    palette: {
      label: "Edge palette",
      component: "palette-picker",
      options: sequencePaletteOptions
    },
    glow: unitSlider( "Edge light" )
  }
};

const sequenceCameraField: FieldConfig = {
  label: "Camera",
  component: "nested-object",
  fields: {
    move: {
      label: "Move",
      component: "select",
      options: enumOptions(
        SEQUENCE_CAMERA_MOVES,
        {
          none: "Still",
          "push-in": "Push in",
          "pull-out": "Pull out",
          "pan-left": "Pan left",
          "pan-right": "Pan right",
          "pan-up": "Pan up",
          "pan-down": "Pan down",
          drift: "Drift",
          orbit: "Orbit",
          handheld: "Handheld"
        }
      )
    },
    amount: unitSlider( "Amount" ),
    easing: {
      label: "Easing",
      component: "easing"
    },
    shake: unitSlider( "Shake" ),
    roll: {
      label: "Roll (°)",
      component: "slider",
      min: -45,
      max: 45,
      step: 0.5
    }
  }
};

const sequencePlateField: FieldConfig = {
  label: "Plate",
  component: "nested-object",
  fields: {
    palette: {
      label: "Palette",
      component: "palette-picker",
      options: sequencePaletteOptions
    },
    gradient: {
      label: "Gradient",
      component: "select",
      options: enumOptions( SEQUENCE_PLATE_GRADIENTS )
    },
    from: {
      label: "From",
      component: "color"
    },
    to: {
      label: "To",
      component: "color"
    },
    angle: angleSlider( "Angle (°)" ),
    drift: unitSlider( "Drift" ),
    grain: unitSlider( "Grain" )
  }
};

// The scene cut (SceneCutSchema): a slide's entrance and exit against a
// plate, edited in the transition band (SceneCutSettings) with the same
// blocks a sequence's scenes use. The exit follows the entrance unless told
// otherwise (`outFollows`), so `out` only shows when it is its own; while it
// follows, `outDuration` is the one field of `out` the panel still offers.
export const sceneCutFieldConfigs: Record<
  "in" | "out" | "plate" | "outFollows" | "outOwnDuration" | "outDuration",
  FieldConfig
> = {
  in: {
    ...sequenceTransitionField,
    label: "In — out of the plate"
  },
  outFollows: {
    label: "Out — into the plate",
    component: "select",
    options: [
      {
        label: "↺ Rewind in (matched)",
        value: "rewind"
      },
      {
        label: "→ Same as in",
        value: "same"
      },
      {
        label: "Own settings",
        value: "own"
      }
    ]
  },
  outOwnDuration: {
    label: "Own duration",
    component: "checkbox"
  },
  outDuration: {
    label: "Out duration (s)",
    component: "slider",
    min: 0,
    max: 10,
    step: 0.05
  },
  out: {
    ...sequenceTransitionField,
    label: "Out — own settings",
    initialExpanded: true
  },
  plate: sequencePlateField
};

// Every scene: its share of the loop, its entrance, its camera.
const sequenceSceneBaseConfig: Record<string, FieldConfig> = {
  weight: {
    label: "Weight (relative length)",
    component: "slider",
    min: 0.1,
    max: 10,
    step: 0.1,
    default: 1
  },
  transition: sequenceTransitionField,
  camera: sequenceCameraField
};

const sequenceSceneConfigs: Record<string, Record<string, FieldConfig>> = {
  sketch: {
    sketch: {
      label: "Sketch",
      component: "sketch-picker"
    },
    settings: {
      component: "sketch-settings",
      default: {}
    },
    ...sequenceSceneBaseConfig,
    loops: {
      label: "Loops over the scene (0 = follow)",
      component: "slider",
      min: 0,
      max: 8,
      step: 0.25,
      default: 1
    },
    progression: {
      ...unitSlider( "Start at" ),
      default: 0
    },
    framerate: {
      label: "Frame rate (0 = follow)",
      component: "slider",
      min: 0,
      max: 120,
      step: 1,
      default: 0
    },
    resolution: {
      label: "Render resolution",
      component: "slider",
      min: 0.05,
      max: 2,
      step: 0.05,
      default: 1
    },
    drawBackground: {
      label: "Draw its own background",
      component: "checkbox",
      default: true
    },
    clearEachFrame: {
      label: "Clear between frames",
      component: "checkbox",
      default: true
    }
  },
  splash: {
    title: {
      label: "Title",
      component: "textarea",
      default: "SKETCHBOOK"
    },
    subtitle: {
      label: "Subtitle",
      component: "text",
      default: ""
    },
    ...sequenceSceneBaseConfig,
    font: {
      label: "Font",
      component: "select",
      options: fontSelectOptions,
      default: "martian"
    },
    size: {
      label: "Size",
      component: "slider",
      min: 8,
      max: 400,
      step: 1,
      default: 120
    },
    fill: {
      label: "Text colour",
      component: "color"
    },
    align: {
      label: "Align",
      component: "select",
      options: enumOptions( HorizontalAlign.options ),
      default: "center"
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
      label: "Text animation",
      component: "select",
      options: enumOptions( SEQUENCE_SPLASH_ANIMATIONS ),
      default: "letters"
    },
    accent: {
      label: "Accent",
      component: "select",
      options: enumOptions( SEQUENCE_SPLASH_ACCENTS ),
      default: "bars"
    },
    background: sequencePlateField
  },
  loader: {
    label: {
      label: "Label",
      component: "text",
      default: "LOADING"
    },
    style: {
      label: "Style",
      component: "select",
      options: enumOptions(
        SEQUENCE_LOADER_STYLES,
        {
          boot: "Boot log"
        }
      ),
      default: "bar"
    },
    ...sequenceSceneBaseConfig,
    font: {
      label: "Font",
      component: "select",
      options: fontSelectOptions,
      default: "spaceMonoRegular"
    },
    size: {
      label: "Size",
      component: "slider",
      min: 8,
      max: 120,
      step: 1,
      default: 28
    },
    fill: {
      label: "Colour",
      component: "color"
    },
    showPercent: {
      label: "Show percent",
      component: "checkbox",
      default: true
    },
    stutter: {
      ...unitSlider( "Stutter" ),
      default: 0.35
    },
    background: sequencePlateField
  },
  plate: {
    ...sequenceSceneBaseConfig,
    background: sequencePlateField
  }
};

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
    source: hudPointSourceField,
    size: hudSizeField( 48 ),
    ...hudWindowFields,
    ...hudElementStyleFields
  },
  "hud-readout": {
    enabled: hudEnabledField,
    source: hudSourceField,
    anchor: hudAnchorField,
    offset: hudOffsetField,
    size: hudSizeField( 160 ),
    label: hudLabelField,
    layout: {
      label: "Layout",
      component: "select",
      options: [
        {
          value: "stacked",
          label: "Stacked (label above)"
        },
        {
          value: "inline",
          label: "Inline (label before)"
        }
      ]
    },
    uppercase: {
      label: "Uppercase value",
      component: "checkbox"
    },
    ...hudWindowFields,
    ...hudElementStyleFields,
    ...hudBoxStyleFields
  },
  "hud-vector": {
    enabled: hudEnabledField,
    source: hudPointSourceField,
    anchor: hudAnchorField,
    offset: hudOffsetField,
    size: hudSizeField( 48 ),
    space: {
      label: "Value space",
      component: "select",
      options: [
        {
          value: "value",
          label: "Parameter units (min–max)"
        },
        {
          value: "canvas",
          label: "Canvas pixels"
        }
      ]
    },
    min: {
      label: "Domain min",
      component: "number"
    },
    max: {
      label: "Domain max",
      component: "number"
    },
    yDown: {
      label: "Y grows downward",
      component: "checkbox"
    },
    coordinates: {
      label: "Coordinates",
      component: "select",
      options: [
        {
          value: "relative",
          label: "Relative (parameter units)"
        },
        {
          value: "absolute",
          label: "Absolute (canvas pixels)"
        },
        {
          value: "none",
          label: "None"
        }
      ]
    },
    decimals: hudDecimalsField,
    label: hudLabelField,
    ...hudWindowFields,
    ...hudElementStyleFields,
    ...hudBoxStyleFields
  },
  "hud-vector3d": {
    enabled: hudEnabledField,
    source: {
      label: "Source",
      component: "source-select",
      kind: "triple"
    },
    view: {
      label: "View",
      component: "vector3d-view"
    },
    kind: {
      label: "Value",
      component: "select",
      options: [
        {
          value: "position",
          label: "Position (floor and shadow)"
        },
        {
          value: "direction",
          label: "Direction (arrow from the centre)"
        }
      ]
    },
    anchor: hudAnchorField,
    offset: hudOffsetField,
    size: hudSizeField( 48 ),
    domain: {
      label: "Domain",
      component: "nested-object",
      fields: {
        xMin: {
          label: "X min",
          component: "number"
        },
        xMax: {
          label: "X max",
          component: "number"
        },
        yMin: {
          label: "Y min",
          component: "number"
        },
        yMax: {
          label: "Y max",
          component: "number"
        },
        zMin: {
          label: "Z min",
          component: "number"
        },
        zMax: {
          label: "Z max",
          component: "number"
        }
      }
    },
    yDown: {
      label: "Y grows downward",
      component: "checkbox"
    },
    trail: {
      label: "Trail",
      component: "checkbox"
    },
    spin: {
      label: "Spin (turns per loop)",
      component: "slider",
      min: 0,
      max: 4,
      step: 0.25,
      visibleWhen: {
        field: "view",
        in: [
          "box",
          "gizmo"
        ]
      }
    },
    coordinates: {
      label: "Coordinates",
      component: "select",
      options: [
        {
          value: "relative",
          label: "Relative (parameter units)"
        },
        {
          value: "none",
          label: "None"
        }
      ]
    },
    decimals: hudDecimalsField,
    label: hudLabelField,
    ...hudWindowFields,
    ...hudElementStyleFields,
    ...hudBoxStyleFields
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
      options: layerAspectRatioOptions
    },
    // What "Size" does to the sketch inside. The two are genuinely different
    // looks, not a right and a wrong one — a background reflows into the layer,
    // a sketch drawn at absolute pixel sizes has to be scaled or it is cropped.
    sizing: {
      label: "Size behaviour",
      component: "select",
      options: [
        {
          value: "reflow",
          label: "Re-lay out for the layer"
        },
        {
          value: "scale",
          label: "Scale the whole render"
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
    // Unchecking freezes the layer on the frame `progression` picks; while it
    // plays, `progression` offsets the layer's loop against the page's.
    play: {
      label: "Play the animation",
      component: "checkbox"
    },
    progression: {
      label: "Progression",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.001
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
  sequence: {
    enabled: {
      label: "Visible",
      component: "checkbox"
    },
    // Each row is one scene; the kind selector inside it swaps the row's
    // fields, and a new row is a whole default scene (SequenceSceneSchema).
    scenes: {
      label: "Scenes",
      component: "item-list",
      itemConfig: {
        label: "Scene",
        component: "conditional-group",
        conditionalOn: "kind",
        hideNone: true,
        headerShowsValue: true,
        schema: SequenceSceneSchema,
        typeSelector: {
          label: "Kind",
          options: enumOptions(
            [
              "sketch",
              "splash",
              "loader",
              "plate"
            ],
            {
              sketch: "Sketch",
              splash: "Splash card",
              loader: "Loading screen",
              plate: "Colour plate"
            }
          )
        },
        configs: sequenceSceneConfigs
      }
    },
    loop: {
      label: "Loop",
      component: "select",
      options: enumOptions(
        SEQUENCE_LOOP_MODES,
        {
          cyclic: "Cyclic (last cuts back to first)",
          once: "Once (hold the last scene)"
        }
      )
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
      options: layerAspectRatioOptions
    },
    rotation: {
      label: "Rotation",
      component: "slider",
      min: 0,
      max: Math.PI * 2,
      step: 0.001
    },
    opacity: unitSlider( "Opacity" ),
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
    grade: {
      label: "Film grade",
      component: "nested-object",
      fields: {
        letterbox: {
          label: "Letterbox",
          component: "slider",
          min: 0,
          max: 0.4,
          step: 0.005
        },
        vignette: unitSlider( "Vignette" ),
        grain: unitSlider( "Grain" ),
        aberration: unitSlider( "Chromatic aberration" ),
        saturation: {
          label: "Saturation",
          component: "slider",
          min: 0,
          max: 2,
          step: 0.01
        },
        contrast: {
          label: "Contrast",
          component: "slider",
          min: 0.5,
          max: 2,
          step: 0.01
        },
        tint: {
          label: "Tint",
          component: "color"
        },
        tintAmount: unitSlider( "Tint amount" ),
        scanlines: unitSlider( "Scanlines" )
      }
    },
    sound: {
      label: "Cut sound",
      component: "nested-object",
      fields: {
        enabled: {
          label: "Play a hit at each cut",
          component: "checkbox"
        },
        preset: {
          label: "Sound",
          component: "select",
          options: enumOptions(
            SPECS_SOUND_PRESETS,
            {
              wood: "Woodblock"
            }
          )
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
          label: "Humanize",
          component: "slider",
          min: 0,
          max: 1,
          step: 0.05
        },
        slidePitchSpread: {
          label: "Pitch by scene (oct)",
          component: "slider",
          min: -2,
          max: 2,
          step: 0.05
        },
        repeat: {
          label: "Repeat",
          component: "conditional-group",
          conditionalOn: "mode",
          hideNone: true,
          schema: SlideTransitionSoundRepeatSchema,
          typeSelector: {
            label: "Mode",
            options: [
              {
                value: "once",
                label: "Once per cut"
              },
              {
                value: "count",
                label: "Burst (N hits)"
              }
            ]
          },
          configs: {
            once: {},
            count: {
              times: {
                label: "Hits",
                component: "slider",
                min: 2,
                max: 16,
                step: 1,
                default: 3
              },
              interval: {
                label: "Interval (s)",
                component: "slider",
                min: 0.02,
                max: 2,
                step: 0.01,
                default: 0.06
              },
              pitchStep: {
                label: "Pitch ramp (oct/hit)",
                component: "slider",
                min: -0.5,
                max: 0.5,
                step: 0.01,
                default: 0.35
              }
            }
          }
        }
      }
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
