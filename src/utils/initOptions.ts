import {
  OptionsSchema, SketchOption
} from "@/types/sketch.types";
import migrateInteractiveOptions from "@/utils/migrateInteractiveOptions";

const OptionsSchemaWithCatch = OptionsSchema.catch( OptionsSchema.parse( {} ) );

export default function initOptions( initialOptions: unknown ): SketchOption {
  return migrateInteractiveOptions( OptionsSchemaWithCatch.parse( initialOptions ?? {} ) );
}
