import {
  writePendingImport
} from "@/lib/pendingImportOptions";
import type {
  GalleryEntry
} from "./types";

/**
 * Relaunch an entry: its document goes through the sketches listing's
 * sessionStorage handoff (`pendingImportOptions`), which the sketch page
 * consumes on mount and applies through its own import — the same strict
 * parse as a picked .json file — so the page shows the piece exactly as kept.
 * The caller navigates (client-side, as a gallery link does). Answers false
 * when storage refused the document: the sketch then opens with its defaults.
 */
export function stageGalleryEntry( entry: Pick<GalleryEntry, "options" | "name"> ): boolean {
  return writePendingImport( {
    ...entry.options,
    name: entry.name
  } );
}

export function galleryEntryHref( entry: Pick<GalleryEntry, "sketch"> ): string {
  return `/sketches/${ entry.sketch }`;
}
