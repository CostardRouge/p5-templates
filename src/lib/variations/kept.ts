/**
 * The variations of a sketch as the gallery keeps them (lab 9, Q4): a kept
 * piece wearing a mark (`GalleryEntry.variation`) — a CANDIDATE an agent or
 * the person proposed, then ACCEPTED by the person alone. A Variations post
 * is built from accepted pieces only: nothing drawn at random ever reaches a
 * post, and nothing an agent proposed does without his yes.
 *
 * Pure: entries in, counts and a document out.
 */

import type {
  GalleryEntry
} from "../gallery/types";

type Piece = Pick<GalleryEntry, "id" | "at" | "engine" | "name" | "title" | "options" | "variation">;

/** `<engine>/<name>`, the key the Plan and the publish store use. */
export function pieceSketchKey( entry: Pick<GalleryEntry, "engine" | "name"> ): string {
  return `${ entry.engine }/${ entry.name }`;
}

/** The variations of `sketchKey` among `entries`, accepted first, then newest first. */
export function variationsOf<T extends Pick<GalleryEntry, "at" | "engine" | "name" | "variation">>(
  entries: readonly T[], sketchKey: string
): T[] {
  return entries.filter( ( entry ) => entry.variation && pieceSketchKey( entry ) === sketchKey )
    .sort( (
      a, b
    ) => Number( b.variation!.state === "accepted" ) - Number( a.variation!.state === "accepted" ) || b.at - a.at );
}

/** How many variations of each sketch the person accepted. */
export function acceptedCounts( entries: readonly Pick<GalleryEntry, "engine" | "name" | "variation">[] ): Record<string, number> {
  const out: Record<string, number> = {};

  for ( const entry of entries ) {
    if ( entry.variation?.state === "accepted" ) {
      const key = pieceSketchKey( entry );

      out[ key ] = ( out[ key ] ?? 0 ) + 1;
    }
  }

  return out;
}

function isRecord( value: unknown ): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

/**
 * The sketch parameters a kept piece shows: its root's, under its first
 * slide's when it has slides (a slide's parameters win key by key).
 */
export function pieceSettings( options: Record<string, unknown> ): Record<string, unknown> {
  const root = isRecord( options.sketch ) ? options.sketch : {};
  const first = Array.isArray( options.slides ) && isRecord( options.slides[ 0 ] ) && isRecord( options.slides[ 0 ].sketch ) ? options.slides[ 0 ].sketch : {};

  return JSON.parse( JSON.stringify( {
    ...root,
    ...first
  } ) ) as Record<string, unknown>;
}

function slideName(
  piece: Piece, index: number
): string {
  return ( piece.variation?.label || piece.title || `Variation ${ index + 1 }` ).slice(
    0,
    80
  );
}

/**
 * The document of a Variations post: the sketch with one SLIDE per accepted
 * piece, each carrying that piece's own settings — a carousel once exported
 * as stills, a cut from look to look as a video. The oldest accepted piece
 * gives the canvas, the clock and the content. One piece alone is that piece.
 * Null when fewer than `min` accepted pieces are given.
 */
export function variationsDocument(
  pieces: readonly Piece[], min: number, max: number
): Record<string, unknown> | null {
  const accepted = pieces.filter( ( piece ) => piece.variation?.state === "accepted" ).sort( (
    a, b
  ) => a.at - b.at )
    .slice(
      0,
      max
    );

  if ( !accepted.length || accepted.length < min ) {
    return null;
  }

  const {
    id: _id, ...base
  } = JSON.parse( JSON.stringify( accepted[ 0 ].options ) ) as Record<string, unknown>;

  if ( accepted.length === 1 ) {
    return {
      ...base,
      name: accepted[ 0 ].name
    };
  }

  return {
    ...base,
    name: accepted[ 0 ].name,
    sketch: pieceSettings( accepted[ 0 ].options ),
    slides: accepted.map( (
      piece, index
    ) => ( {
      name: slideName(
        piece,
        index
      ),
      sketch: pieceSettings( piece.options )
    } ) )
  };
}
