import {
  ContentItem, PatternSchema, Blend, HorizontalAlign, VerticalAlign, ImageItemAnimations, ImagesStackAnimations
} from "@/types/sketch.types";

import {
  ZodObject, ZodDiscriminatedUnion, ZodTypeAny
} from "zod";

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

// For 'select' inputs
interface SelectConfig extends BaseConfig {
  component: "select";
  noneLabel?: string;
  options: Array<{
    label: string; value: string | number
  }>;
}

// For static, non-conditional nested objects
interface NestedObjectConfig extends BaseConfig {
  component: "nested-object";
  // The 'fields' property contains a map where keys are field names
  // and values are any valid FieldConfig. This enables recursion.
  fields: Record<string, FieldConfig>;
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
}

type Scope = "global" | {
 slide: number
};

interface ImageConfig extends BaseConfig {
  component: "image";
  assetsName?: string;
  scope?: Scope;
  jobId?: string;
  label?: string;
}

interface ImagesStackConfig extends BaseConfig {
  component: "images-stack";
  assetsName?: string;
  scope?: Scope;
  jobId?: string;
  label?: string;
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
  | NestedObjectConfig
  | ConditionalGroupConfig
  | ImagesStackConfig
  | ImageConfig;

// Define the configuration for an entire item type (e.g., 'meta' or 'text')
// The keys of this record must match the field names in the Zod schema
type ItemFormConfig = Record<string, FieldConfig>;

const fontNames = [
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
  "peix"
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
  },
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
  },
};

// Main configuration object
// The top-level keys MUST match the 'type' in your Zod discriminated union
// @ts-ignore
export const formConfig: Record<ContentItem["type"], ItemFormConfig> = {
  meta: {
    fill: {
      label: "Fill",
      component: "color"
    },
    stroke: {
      label: "Stroke",
      component: "color"
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
          component: "checkbox",
        },
        stroke: {
          label: "Stroke",
          component: "color"
        },
      }
    }
  },
  text: {
    content: {
      label: "Content",
      component: "textarea"
    },
    size: {
      label: "Size",
      component: "number",
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
      options: fontNames.map( fontName => ( {
        value: fontName,
        label: fontName
      } ) ),
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
    align: {
      label: "Alignment",
      component: "nested-object",
      fields: {
        0: {
          label: "Horizontal alignment",
          component: "select",
          options: HorizontalAlign.options.map( horizontalAlignOption => ( {
            value: horizontalAlignOption,
            label: horizontalAlignOption
          } ) )
        },
        1: {
          label: "Vertical alignment",
          component: "select",
          options: VerticalAlign.options.map( verticalAlignOption => ( {
            value: verticalAlignOption,
            label: verticalAlignOption
          } ) )
        }
      }
    },
    horizontalMargin: {
      label: "Horizontal margin",
      component: "number",
      step: 0.01,
      min: 0,
      max: 1
    },
    verticalMargin: {
      label: "Vertical margin",
      component: "number",
      step: 0.01,
      min: 0,
      max: 1
    },
    blend: {
      label: "Blend",
      component: "select",
      options: Blend.options.map( blendOption => ( {
        value: blendOption,
        label: blendOption
      } ) )
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
          },
        ],
      },

      // A map of which config to use for each 'type'
      configs: {
        grid: gridPatternFields,
        dots: dotsPatternFields
      },

      // The schema is needed to create default objects when the type changes

      // @ts-ignore
      schema: PatternSchema,
    },
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
      component: "checkbox",
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
          },
        ],
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
          },
        }
      },

      schema: ImageItemAnimations,
    },
  },
  "images-stack": {
    sources: {
      label: "Sources",
      component: "images-stack"
    },
    margin: {
      label: "Margin",
      component: "number",
    },
    center: {
      label: "Center",
      component: "checkbox",
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
            label: "Random move",
            value: "random"
          },
        ],
      },
      configs: {
        random: {
          shift: {
            label: "Shift",
            component: "number",
            step: 1,
            min: 1,
            max: 30
          },
        }
      },

      schema: ImagesStackAnimations,
    },
  }
  // Add other types like 'image', 'video' here
};
