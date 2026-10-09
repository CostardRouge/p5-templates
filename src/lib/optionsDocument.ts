import {
  z
} from "zod";

import {
  OptionsSchema
} from "@/types/sketch.types";

/**
 * The options DOCUMENT — everything the studio stores for a piece: canvas
 * size, clock, content items (text, images, HUD, sketch layers…), slides,
 * assets, and the sketch's own parameters under `sketch` — described and
 * checked by the one schema the app itself parses it with (`OptionsSchema`).
 *
 * Exists for callers outside the browser that build a document by hand (the
 * agent commands in `scripts/mcp/`): they get the schema as JSON Schema and a
 * verdict with paths, from the same zod the page and the form use, instead of
 * a second copy of the rules drifting beside the first.
 */

let cachedSchema: Record<string, unknown> | null = null;

/** `OptionsSchema` as JSON Schema (input side: defaults are optional). */
export function optionsJsonSchema(): Record<string, unknown> {
  cachedSchema ??= z.toJSONSchema(
    OptionsSchema,
    {
      io: "input",
      // `z.any()` slots (`sketch`, `interactive`) and preprocessors have no
      // JSON Schema form: they are described as "anything" rather than refused.
      unrepresentable: "any"
    }
  ) as Record<string, unknown>;

  return cachedSchema;
}

export type OptionsIssue = {
  /** Dotted path, `content.2.text`; empty for the root. */
  path: string;
  message: string;
};

function isPlainObject( value: unknown ): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

/**
 * Keys present in `input` that the parse dropped. zod objects strip unknown
 * keys without a word, so a misspelt `text` (the field is `content`) would
 * "validate" and render nothing — the failure a caller cannot see.
 */
function droppedKeys(
  input: unknown, parsed: unknown, path: string[], out: OptionsIssue[]
): void {
  if ( Array.isArray( input ) && Array.isArray( parsed ) ) {
    input.forEach( (
      item, i
    ) => droppedKeys(
      item,
      parsed[ i ],
      [
        ...path,
        String( i )
      ],
      out
    ) );
    return;
  }

  if ( !isPlainObject( input ) || !isPlainObject( parsed ) ) {
    return;
  }

  for ( const key of Object.keys( input ) ) {
    const at = [
      ...path,
      key
    ];

    if ( !( key in parsed ) ) {
      const known = Object.keys( parsed );

      out.push( {
        path: at.join( "." ),
        message: `Unknown key, not part of the options schema${ known.length ? ` — known here: ${ known.join( ", " ) }` : "" }`
      } );
      continue;
    }
    droppedKeys(
      input[ key ],
      parsed[ key ],
      at,
      out
    );
  }
}

/**
 * The document's problems as the page's own parse would see them, plus every
 * key the parse would silently drop; empty when it parses clean.
 */
export function validateOptionsDocument( value: unknown ): OptionsIssue[] {
  const result = OptionsSchema.safeParse( value );

  if ( result.success ) {
    const issues: OptionsIssue[] = [];

    droppedKeys(
      value,
      result.data,
      [],
      issues
    );

    return issues;
  }

  return result.error.issues.map( ( issue ) => ( {
    path: issue.path.map( String ).join( "." ),
    message: issue.message
  } ) );
}
