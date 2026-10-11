import type {
  GalleryStore
} from "./store";
import {
  GALLERY_ORIGINS, type GalleryEntry, type GalleryOrigin
} from "./types";

/**
 * The gallery's backup: ONE JSON file, the thumbnails inline as base64. A
 * zip of JSON + JPEGs was the alternative (`scripts/mcp/zipStore.ts` writes
 * one) and lost on the only criterion that mattered — simplest to restore:
 * one `JSON.parse`, no reader for a format the app has no other use for, and
 * a file a person can open and read. Five hundred entries at ~30 KB is a
 * ~20 MB text file, which every browser builds and parses without blinking.
 */
export const GALLERY_ARCHIVE_FORMAT = "sketchbook-gallery";
export const GALLERY_ARCHIVE_VERSION = 1;

export interface GalleryArchiveEntry extends Omit<GalleryEntry, "thumbnail"> {
  thumbnail: {
    type: string;
    base64: string;
  } | null;
}

export interface GalleryArchive {
  format: typeof GALLERY_ARCHIVE_FORMAT;
  version: typeof GALLERY_ARCHIVE_VERSION;
  exportedAt: string;
  entries: GalleryArchiveEntry[];
}

async function blobToBase64( blob: Blob ): Promise<string> {
  const bytes = new Uint8Array( await blob.arrayBuffer() );
  let binary = "";

  // Chunked: a spread of a few hundred thousand bytes blows the call stack.
  for ( let i = 0; i < bytes.length; i += 0x8000 ) {
    binary += String.fromCharCode( ...bytes.subarray(
      i,
      i + 0x8000
    ) );
  }

  return btoa( binary );
}

function base64ToBlob(
  base64: string, type: string
): Blob {
  const binary = atob( base64 );
  const bytes = new Uint8Array( binary.length );

  for ( let i = 0; i < binary.length; i++ ) {
    bytes[ i ] = binary.charCodeAt( i );
  }

  return new Blob(
    [
      bytes
    ],
    {
      type
    }
  );
}

export async function serializeGallery( entries: GalleryEntry[] ): Promise<string> {
  const archive: GalleryArchive = {
    format: GALLERY_ARCHIVE_FORMAT,
    version: GALLERY_ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    entries: await Promise.all( entries.map( async( entry ) => ( {
      ...entry,
      thumbnail: entry.thumbnail ? {
        type: entry.thumbnail.type || "image/jpeg",
        base64: await blobToBase64( entry.thumbnail )
      } : null
    } ) ) )
  };

  return JSON.stringify( archive );
}

function isRecord( value: unknown ): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

/** One archived entry back into a store entry; throws naming what is wrong. */
function readEntry(
  raw: unknown, index: number
): GalleryEntry {
  if ( !isRecord( raw ) ) {
    throw new Error( `entry ${ index } is not an object` );
  }

  const text = ( key: string ) => {
    const value = raw[ key ];

    if ( typeof value !== "string" || !value ) {
      throw new Error( `entry ${ index }: "${ key }" is missing` );
    }

    return value;
  };
  const at = Number( raw.at );

  if ( !Number.isFinite( at ) ) {
    throw new Error( `entry ${ index }: "at" is not a date` );
  }
  if ( !isRecord( raw.options ) ) {
    throw new Error( `entry ${ index }: "options" is not a document` );
  }

  const thumbnail = raw.thumbnail;

  if ( thumbnail !== null && thumbnail !== undefined && !( isRecord( thumbnail ) && typeof thumbnail.base64 === "string" ) ) {
    throw new Error( `entry ${ index }: "thumbnail" is neither null nor { type, base64 }` );
  }

  const origin = raw.origin;

  return {
    id: text( "id" ),
    at,
    sketch: text( "sketch" ),
    engine: text( "engine" ),
    name: text( "name" ),
    title: typeof raw.title === "string" ? raw.title : "",
    origin: GALLERY_ORIGINS.includes( origin as GalleryOrigin ) ? origin as GalleryOrigin : "keep",
    options: raw.options,
    fingerprint: text( "fingerprint" ),
    hadAssets: raw.hadAssets === true,
    width: Number( raw.width ) > 0 ? Number( raw.width ) : 1080,
    height: Number( raw.height ) > 0 ? Number( raw.height ) : 1350,
    thumbnail: isRecord( thumbnail ) ? base64ToBlob(
      thumbnail.base64 as string,
      typeof thumbnail.type === "string" ? thumbnail.type : "image/jpeg"
    ) : null
  };
}

/** The entries of an archive file, or a thrown Error saying why it is not one. */
export function parseGalleryArchive( text: string ): GalleryEntry[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse( text );
  } catch {
    throw new Error( "the file is not JSON" );
  }

  if ( !isRecord( parsed ) || parsed.format !== GALLERY_ARCHIVE_FORMAT ) {
    throw new Error( `the file is not a Sketchbook gallery archive (format "${ GALLERY_ARCHIVE_FORMAT }")` );
  }
  if ( Number( parsed.version ) > GALLERY_ARCHIVE_VERSION ) {
    throw new Error( `the archive is version ${ String( parsed.version ) }, newer than this app reads (${ GALLERY_ARCHIVE_VERSION })` );
  }
  if ( !Array.isArray( parsed.entries ) ) {
    throw new Error( "the archive has no entries list" );
  }

  return parsed.entries.map( readEntry );
}

export interface ImportOutcome {
  added: number;
  /** Already there: same id, or the same document of the same sketch. */
  skipped: number;
  /** Pruned by the cap once the archive was in. */
  pruned: number;
}

/**
 * Merge an archive into the store: an entry already present by id, or whose
 * sketch + fingerprint is already there (the same piece kept by another
 * browser, under another id), is skipped. The cap applies afterwards.
 */
export async function importGallery(
  store: GalleryStore, text: string
): Promise<ImportOutcome> {
  const incoming = parseGalleryArchive( text );
  const existing = await store.entries();
  const ids = new Set( existing.map( ( entry ) => entry.id ) );
  const pieces = new Set( existing.map( ( entry ) => `${ entry.sketch }\n${ entry.fingerprint }` ) );
  const fresh: GalleryEntry[] = [];

  for ( const entry of incoming ) {
    const piece = `${ entry.sketch }\n${ entry.fingerprint }`;

    if ( ids.has( entry.id ) || pieces.has( piece ) ) {
      continue;
    }
    ids.add( entry.id );
    pieces.add( piece );
    fresh.push( entry );
  }

  const pruned = fresh.length ? await store.addMany( fresh ) : [];

  return {
    added: fresh.length,
    skipped: incoming.length - fresh.length,
    pruned: pruned.length
  };
}

export async function exportGallery( store: GalleryStore ): Promise<Blob> {
  return new Blob(
    [
      await serializeGallery( await store.entries() )
    ],
    {
      type: "application/json"
    }
  );
}

/** `sketchbook-gallery-YYYY-MM-DD.json`. */
export function galleryArchiveFileName( at: Date = new Date() ): string {
  return `sketchbook-gallery-${ at.toISOString().slice(
    0,
    10
  ) }.json`;
}
