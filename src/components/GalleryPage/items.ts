import type {
  GalleryEntry
} from "@/lib/gallery/types";
import type {
  GallerySend
} from "@/lib/gallery/sends";

/** What a calendar day holds: a send (with Postiz), or a piece kept that day (without). */
export type CalendarItem =
  | { kind: "send";
    key: string;
    at: number;
    send: GallerySend;
    /** The piece it left from, when this browser has it. */
    entry: GalleryEntry | null }
  | { kind: "piece";
    key: string;
    at: number;
    entry: GalleryEntry };

/** What opens the sketch sheet: a sketch, and the piece or send that was clicked. */
export interface SheetTarget {
  sketchKey: string;
  pieceId: string | null;
  sendKey: string | null;
}

/** The catalogue's thumbnail for a sketch, for a send whose piece is not in this browser. */
export function catalogueThumbnail( sketchKey: string ): string {
  return `/assets/images/templates/${ sketchKey }/thumbnail.webp`;
}

export function itemTarget( item: CalendarItem ): SheetTarget {
  return item.kind === "send"
    ? {
      sketchKey: item.send.sketchKey,
      pieceId: item.send.pieceId,
      sendKey: item.send.key
    }
    : {
      sketchKey: `${ item.entry.engine }/${ item.entry.name }`,
      pieceId: item.entry.id,
      sendKey: null
    };
}
