/**
 * The snapshot gallery: a browser-only archive of the pieces the studio has
 * exported or kept — the whole options document plus a small JPEG, dated.
 * Never the video (`docs/memory/gallery.md`), never the uploaded assets.
 */

/** What wrote the entry: a finished front-end export, the Keep button, an agent command. */
export type GalleryOrigin = "export" | "keep" | "agent";

export const GALLERY_ORIGINS: readonly GalleryOrigin[] = [
  "export",
  "keep",
  "agent"
];

export interface GalleryEntry {
  id: string;
  /** When it was kept, epoch milliseconds. */
  at: number;
  /** `<engine>/<category>/<name>` — the sketch's route tail, as `studio.open` names it. */
  sketch: string;
  engine: string;
  /** The sketch's name alone (what an imported document is matched on). */
  name: string;
  /** A person's label; empty means "untitled", shown as the sketch's name. */
  title: string;
  origin: GalleryOrigin;
  /** The whole document, as the form held it (`SketchOption`), cloned. */
  options: Record<string, unknown>;
  /** Hash of the canonical document, what dedupes two keeps of one piece. */
  fingerprint: string;
  /** The document referenced uploaded media, which the gallery does not keep. */
  hadAssets: boolean;
  /** The canvas size the document declares, for the card's aspect ratio. */
  width: number;
  height: number;
  /** ~240 px wide JPEG of the frame on screen when kept, or null. */
  thumbnail: Blob | null;
}

/** An entry without its heavy fields, what a list answers. */
export type GalleryEntrySummary = Omit<GalleryEntry, "options" | "thumbnail"> & {
  hasThumbnail: boolean;
};

export function summarize( entry: GalleryEntry ): GalleryEntrySummary {
  const {
    options: _options, thumbnail, ...rest
  } = entry;

  return {
    ...rest,
    hasThumbnail: thumbnail !== null
  };
}

export interface GalleryFilter {
  /** Exact `sketch` path. */
  sketch?: string;
  /** Inclusive epoch-ms bounds on `at`. */
  since?: number;
  until?: number;
  /** Newest first; at most this many. */
  limit?: number;
}
