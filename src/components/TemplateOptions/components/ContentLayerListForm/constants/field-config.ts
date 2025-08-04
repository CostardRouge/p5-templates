import {
  ContentItem
} from "@/types/sketch.types";

// Define the types of UI components we can render
type ComponentType = "text" | "number" | "color" | "textarea" | "checkbox";

// Define the configuration for a single field
export type FieldConfig = {
  label: string;
  component: ComponentType;
  placeholder?: string;
  step?: number; // For number inputs
};

// Define the configuration for an entire item type (e.g., 'meta' or 'text')
// The keys of this record must match the field names in the Zod schema
type ItemFormConfig = Record<string, FieldConfig>;

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
    // We can add more fields here and they will auto-generate
  },
  background: {
    background: {
      label: "Color",
      component: "color"
    }
  },
  // Add other types like 'image', 'video' here
};
