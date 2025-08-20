import {
  SketchOption, OptionsSchema
} from "@/types/sketch.types";

export default function initOptions( initialOptions: unknown ): SketchOption {
  return OptionsSchema.parse( initialOptions ?? {
  } );
}