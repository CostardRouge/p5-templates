import {
  SketchOption, OptionsSchema
} from "@/types/sketch.types";

const OptionsSchemaWithCatch = OptionsSchema.catch( OptionsSchema.parse( {
} ) );

export default function initOptions( initialOptions: unknown ): SketchOption {
  return OptionsSchemaWithCatch.parse( initialOptions ?? {
  } );
}