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
  SpecsHighlightSchema,
  SpecsVisibilitySchema,
  VerticalAlign,
  VisualOptions
} from "@/types/sketch.types";

// Step 1: Define a common base for all config types
interface BaseConfig {
  label?: string; // Label is often optional (e.g., inside a group)
  placeholder?: string;
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

export interface SizePresetConfig extends BaseConfig {
  component: "size-preset";
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
  // The Zod schema is crucial for creating default objects when the type changes
  schema: ZodDiscriminatedUnion<any, any> | ZodObject<any>;
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

interface JsonConfig extends BaseConfig {
  component: "json";
  rows?: number;
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

interface EasingConfig extends BaseConfig {
  component: "easing";
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
  | SizePresetConfig
  | HiddenConfig
  | JsonConfig
  | ItemListConfig
  | HiddenFieldConfig
  | EasingConfig
  | AssetInputConfig
  | AssetStackConfig;

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
// Import these in template options.ts files instead of hardcoding arrays.
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
        }
      }
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
    }
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
      component: "nested-object",
      fields: {
        x: {
          label: "x",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        },
        y: {
          label: "y",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        }
      }
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
      component: "nested-object",
      fields: {
        x: {
          label: "x",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        },
        y: {
          label: "y",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        }
      }
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
      component: "nested-object",
      fields: {
        x: {
          label: "x",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        },
        y: {
          label: "y",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        }
      }
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
      component: "nested-object",
      fields: {
        x: {
          label: "x",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        },
        y: {
          label: "y",
          component: "slider",
          step: 0.01,
          min: 0,
          max: 1
        }
      }
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
        }
      }
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
