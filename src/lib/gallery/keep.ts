import {
  documentHasAssets, fingerprintDocument
} from "./canonical";
import {
  galleryId, type GalleryStore
} from "./store";
import type {
  GalleryEntry, GalleryOrigin
} from "./types";

export interface KeepInput {
  engine: string;
  category?: string | null;
  name: string;
  /** The document as the form holds it; cloned here, never mutated. */
  options: unknown;
  origin: GalleryOrigin;
  title?: string;
  thumbnail: Blob | null;
  /** Override the clock (tests). */
  at?: number;
}

export interface KeepResult {
  entry: GalleryEntry;
  /** False when the newest entry of this sketch already held this document. */
  kept: boolean;
  pruned: string[];
}

/** `engine/category/name`, the sketch's route tail. */
export function sketchPath(
  engine: string, category: string | null | undefined, name: string
): string {
  return [
    engine,
    category,
    name
  ].filter( Boolean ).join( "/" );
}

function sizeOf( options: Record<string, unknown> ): { width: number;
  height: number } {
  const size = options.size as { width?: unknown;
    height?: unknown } | undefined;
  const width = Number( size?.width );
  const height = Number( size?.height );

  return {
    width: Number.isFinite( width ) && width > 0 ? width : 1080,
    height: Number.isFinite( height ) && height > 0 ? height : 1350
  };
}

/**
 * Archive the current piece — the one gesture behind the Keep button, the end
 * of a successful export and `gallery.keep`. The document is cloned through
 * JSON (what the options export writes), its `name` set to the sketch's so the
 * sketch page's import handoff matches it on relaunch. A document identical to
 * the sketch's newest entry is NOT stored again: that entry is answered, with
 * its title updated when a new one was given.
 */
export async function keepPiece(
  store: GalleryStore, input: KeepInput
): Promise<KeepResult> {
  const options = JSON.parse( JSON.stringify( input.options ?? {} ) ) as Record<string, unknown>;

  options.name = input.name;

  const sketch = sketchPath(
    input.engine,
    input.category,
    input.name
  );
  const fingerprint = fingerprintDocument( options );
  const title = input.title?.trim() ?? "";
  const latest = await store.latestOf( sketch );

  if ( latest && latest.fingerprint === fingerprint ) {
    const entry = title && title !== latest.title
      ? await store.rename(
        latest.id,
        title
      ) ?? latest
      : latest;

    return {
      entry,
      kept: false,
      pruned: []
    };
  }

  const entry: GalleryEntry = {
    id: galleryId(),
    at: input.at ?? Date.now(),
    sketch,
    engine: input.engine,
    name: input.name,
    title,
    origin: input.origin,
    options,
    fingerprint,
    hadAssets: documentHasAssets( options ),
    ...sizeOf( options ),
    thumbnail: input.thumbnail
  };
  const pruned = await store.add( entry );

  return {
    entry,
    kept: true,
    pruned
  };
}
