import {
  ContentItem, PatternSchema
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

// For 'color' inputs
interface ColorInputConfig extends BaseConfig {
  component: "color";
}

// For 'select' inputs
interface SelectConfig extends BaseConfig {
  component: "select";
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

// Step 3: Create the master Discriminated Union
// This tells TypeScript: "If component is 'select', then it MUST have an 'options' property."
export type FieldConfig =
  | SimpleInputConfig
  | NumberInputConfig
  | ColorInputConfig
  | SelectConfig
  | NestedObjectConfig
  | ConditionalGroupConfig;

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

const blendOptions = [
  "source-over",
  "darken",
  "lighten",
  "difference",
  "multiply",
  "exclusion",
  "screen",
  "copy",
  "overlay",
  "hard-light",
  "soft-light",
  "color-dodge",
  "color-burn",
  "lighter",
  "normal"
];

const gridPatternFields: ItemFormConfig = {
  columns: {
    label: "Columns",
    component: "number",
    step: 1
  },
  strokeWeight: {
    label: "Stroke Weight",
    component: "number",
    step: 0.5
  },
  stroke: {
    label: "Stroke Color",
    component: "color"
  },
};

const dotsPatternFields: ItemFormConfig = {
  size: {
    label: "Dot Size",
    component: "number",
    step: 1
  },
  padding: {
    label: "Padding",
    component: "number",
    step: 1
  },
  fill: {
    label: "Fill Color",
    component: "color"
  },
};

// Main configuration object
// The top-level keys MUST match the 'type' in your Zod discriminated union
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
      placeholder: "@costardrouge.jpg"
    },
    topRight: {
      label: "Top right",
      component: "text",
      placeholder: "AUGUST 2025"
    },
    bottomLeft: {
      label: "Bottom left",
      component: "text",
      placeholder: "Social pipeline"
    },
    bottomRight: {
      label: "Bottom right",
      component: "text",
      placeholder: "#42"
    },
  },
  text: {
    content: {
      label: "Content",
      component: "textarea"
    },
    size: {
      label: "Size",
      component: "number",
      step: 1
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
    blend: {
      label: "Blend",
      component: "select",
      options: blendOptions.map( blendOption => ( {
        value: blendOption,
        label: blendOption
      } ) )
    },
    position: {
      label: "Position",
      component: "nested-object",
      fields: {
        x: {
          label: "x",
          component: "number",
          step: 0.01,
          min: 0,
          max: 1
        },
        y: {
          label: "y",
          component: "number",
          step: 0.01,
          min: 0,
          max: 1
        }
      }
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
      schema: PatternSchema,
    },
  }
  // Add other types like 'image', 'video' here
};
