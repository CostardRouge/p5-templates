import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import {
  WaveConfigSchema
} from "@/p5/sketches/36days-of-type-2023/36days-of-type-2023-5/schemas";

/**
 * Injects Zod schemas into sketch configurations on the client side.
 * This is necessary because schemas can't be serialized from server to client components.
 */
export function injectSketchSchemas(
  sketchName: string,
  config: Record<string, FieldConfig>
): Record<string, FieldConfig> {
  // Clone the config to avoid mutations
  const clonedConfig = JSON.parse( JSON.stringify( config ) );

  // Add schemas based on sketch name
  if ( sketchName.startsWith( "36days-of-type-2023-" ) ) {
    // Navigate to the wave conditional-group and inject the schema
    if ( clonedConfig.animation?.fields?.wave ) {
      clonedConfig.animation.fields.wave.schema = WaveConfigSchema;
    }
  }

  return clonedConfig;
}
