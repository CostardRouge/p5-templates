import {
  OptionsSchema, SketchOption
} from "@/types/sketch.types";
import migrateInteractiveOptions from "@/utils/migrateInteractiveOptions";
import migrateLegacyHudItems from "@/utils/migrateLegacyHudItems";

const OptionsSchemaWithCatch = OptionsSchema.catch( OptionsSchema.parse( {} ) );

export default function initOptions( initialOptions: unknown ): SketchOption {
  // The HUD migration runs BEFORE the parse: a legacy `type: "hud"` content
  // item fails the discriminated union and the top-level `.catch` would then
  // reset the whole options to defaults.
  return migrateInteractiveOptions( OptionsSchemaWithCatch.parse( migrateLegacyHudItems( initialOptions ?? {} ) ) );
}
