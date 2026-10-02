import {
  OptionsSchema, SketchOption
} from "@/types/sketch.types";
import migrateInteractiveOptions from "@/utils/migrateInteractiveOptions";
import migrateLegacyHudItems from "@/utils/migrateLegacyHudItems";

export type ParsedImport = {
  ok: true;
  options: SketchOption;
} | {
  ok: false;
  reason: string;
};

/**
 * Validate an imported options file strictly.
 *
 * `initOptions` is for loading what the app itself saved: its top-level
 * `.catch` turns any parse failure into the schema's empty defaults. For a
 * file the user picked, that meant replacing their whole document with a
 * blank one and then announcing "Options imported successfully". Here a
 * failure is reported instead, naming the first offending path, and the
 * caller leaves the form untouched. On success the result is exactly what
 * `initOptions` returns for the same input (same migrations, same parse).
 */
export default function parseImportedOptions( value: unknown ): ParsedImport {
  if ( typeof value !== "object" || value === null || Array.isArray( value ) ) {
    return {
      ok: false,
      reason: "the file does not contain an options object"
    };
  }

  const result = OptionsSchema.safeParse( migrateLegacyHudItems( value ) );

  if ( !result.success ) {
    const [
      issue
    ] = result.error.issues;
    const where = issue.path.length > 0 ? issue.path.join( "." ) : "the file";

    return {
      ok: false,
      reason: `${ where }: ${ issue.message }`
    };
  }

  return {
    ok: true,
    options: migrateInteractiveOptions( result.data )
  };
}
