/**
 * The options document's JSON Schema (`GET /api/options/schema`) is ~80 KB —
 * too much to hand an agent at once, and mostly content item types it will not
 * use. `schemaPart` answers it a piece at a time: an overview, the list of
 * content item types, one item type, or one top-level field.
 *
 * Pure.
 */
import {
  CommandError, isRecord
} from "./registry.ts";

type Schema = Record<string, unknown>;

function properties( schema: unknown ): Record<string, Schema> {
  return isRecord( schema ) && isRecord( schema.properties ) ? schema.properties as Record<string, Schema> : {};
}

/** The content item schemas, keyed by their `type` constant. */
export function contentItemTypes( schema: Schema ): Record<string, Schema> {
  const content = properties( schema ).content;
  const items = isRecord( content ) && isRecord( content.items ) ? content.items : {};
  const union = ( items.oneOf ?? items.anyOf ) as unknown;
  const out: Record<string, Schema> = {};

  for ( const item of Array.isArray( union ) ? union : [] ) {
    const type = properties( item ).type;
    const name = isRecord( type ) ? type.const : undefined;

    if ( typeof name === "string" ) {
      out[ name ] = item as Schema;
    }
  }

  return out;
}

const TOP_LEVEL_NOTES: Record<string, string> = {
  size: "canvas size in px",
  animation: "the loop: framerate (fps) and duration (s)",
  content: "items drawn over the sketch: text, title, image, qrcode, HUD widgets, sketch layers… (part \"content\" lists them)",
  slides: "a deck: each slide may carry its own size, animation, content and sketch parameters (one MP4 per slide)",
  assets: "managed by drafts.* files — not set by hand",
  sketch: "the sketch's own parameters — set them as `options` (sketches.describe)",
  interactive: "interaction bindings (MIDI, pointer, sensors → parameters)"
};

export function schemaPart(
  schema: Schema, part?: string
): unknown {
  const top = properties( schema );
  const types = contentItemTypes( schema );

  if ( !part ) {
    return {
      parts: Object.fromEntries( Object.keys( top ).map( ( key ) => [
        key,
        TOP_LEVEL_NOTES[ key ] ?? ""
      ] ) ),
      contentTypes: Object.keys( types ),
      ask: "options.schema { part } with a field (\"size\", \"slides\"…), \"content\" for the item list, \"content.<type>\" for one item, or \"all\""
    };
  }

  if ( part === "all" ) {
    return schema;
  }

  if ( part === "content" ) {
    return Object.fromEntries( Object.entries( types ).map( ( [
      name,
      item
    ] ) => [
      name,
      Object.keys( properties( item ) ).filter( ( key ) => key !== "type" )
    ] ) );
  }

  if ( part.startsWith( "content." ) ) {
    const name = part.slice( "content.".length );
    const item = types[ name ];

    if ( !item ) {
      throw new CommandError(
        "invalid",
        `no content item type "${ name }" — ${ Object.keys( types ).join( ", " ) }`
      );
    }

    return item;
  }

  if ( part in top ) {
    return top[ part ];
  }

  throw new CommandError(
    "invalid",
    `no part "${ part }" — ${ [
      ...Object.keys( top ),
      "content.<type>",
      "all"
    ].join( ", " ) }`
  );
}
