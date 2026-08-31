import {
  ITEM_META
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/constants/item-kinds";
import type {
  ItemKind
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";

/** Longest preview shown on a layer row before it is cut with an ellipsis. */
const PREVIEW_MAX_LENGTH = 32;

export type ContentItemDescription = {
  /** What the layer is — the item type's own label ("Text", "Image"…). */
  label: string;
  /** What this particular layer carries, when it carries anything readable. */
  preview?: string;
};

function truncate( value: string ): string {
  const collapsed = value.replace(
    /\s+/g,
    " "
  ).trim();

  if ( collapsed.length <= PREVIEW_MAX_LENGTH ) {
    return collapsed;
  }

  const cut = collapsed.slice(
    0,
    PREVIEW_MAX_LENGTH - 1
  );
  // Back off to the last word boundary when one is near, so a row reads
  // "a line and another that…" rather than "…that runs we…".
  const lastSpace = cut.lastIndexOf( " " );
  const kept = lastSpace > PREVIEW_MAX_LENGTH / 2 ? cut.slice(
    0,
    lastSpace
  ) : cut;

  return `${ kept.trimEnd() }…`;
}

/** Last path segment of an asset reference, without its query string. */
function basename( source: string ): string {
  const withoutQuery = source.split( "?" )[ 0 ] ?? source;
  const segments = withoutQuery.split( "/" );

  return segments[ segments.length - 1 ] || withoutQuery;
}

function firstNonEmpty( ...values: unknown[] ): string | undefined {
  for ( const value of values ) {
    if ( typeof value === "string" && value.trim() ) {
      return value;
    }
  }

  return undefined;
}

/**
 * Name a content item for the layers list.
 *
 * Content items have **no name field** — `ContentItemSchema` is a discriminated
 * union on `type` and nothing else identifies an item — so a layer's name is
 * derived, never stored: the type's own label, plus whatever the item carries
 * that a person would recognise it by (the text it prints, the file it shows).
 * This is the only place that decides how a layer reads; the rows, the detail
 * header and any future search all go through it.
 */
export default function describeContentItem( item: unknown ): ContentItemDescription {
  const record = ( item ?? {} ) as Record<string, unknown>;
  const type = record.type as ItemKind | undefined;
  const meta = type ? ITEM_META[ type ] : undefined;
  const label = meta?.label ?? ( type ? String( type ) : "Layer" );

  const preview = ( () => {
    switch ( type ) {
      case "text":
      case "title":
        return firstNonEmpty( record.content );

      case "image": {
        const source = firstNonEmpty( record.source );

        return source ? basename( source ) : undefined;
      }

      case "images-stack": {
        const sources = record.sources;

        if ( !Array.isArray( sources ) || sources.length === 0 ) {
          return undefined;
        }

        return sources.length === 1
          ? basename( String( sources[ 0 ] ) )
          : `${ sources.length } images`;
      }

      case "visual": {
        const visual = record.visual as Record<string, unknown> | undefined;

        return firstNonEmpty( visual?.name );
      }

      case "specs":
        return firstNonEmpty( record.style );

      case "meta":
        // The four corners are independent strings; the first one filled in is
        // the one a person recognises the block by.
        return firstNonEmpty(
          record.topLeft,
          record.topRight,
          record.bottomLeft,
          record.bottomRight
        );

      case "background": {
        const pattern = record.pattern as Record<string, unknown> | undefined;

        return firstNonEmpty( pattern?.type );
      }

      case "qrcode":
        return firstNonEmpty( record.domainOverride );

      default:
        return undefined;
    }
  } )();

  return {
    label,
    preview: preview ? truncate( preview ) : undefined
  };
}
