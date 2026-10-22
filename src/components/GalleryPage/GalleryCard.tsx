"use client";

import React, {
  useEffect, useState
} from "react";
import clsx from "clsx";
import {
  ImageOff, Pencil, Trash2
} from "lucide-react";

import type {
  GalleryEntry
} from "@/lib/gallery/types";
import {
  formatSketchTitle
} from "@/lib/seo";

const ORIGIN_LABEL: Record<GalleryEntry[ "origin" ], string> = {
  export: "exported",
  keep: "kept",
  agent: "agent"
};

const dateFormat = new Intl.DateTimeFormat(
  undefined,
  {
    dateStyle: "medium",
    timeStyle: "short"
  }
);

/** The thumbnail Blob as an object URL for the card's lifetime. */
function useObjectUrl( blob: Blob | null ): string | null {
  const [
    url,
    setUrl
  ] = useState<string | null>( null );

  // The URL is minted in the effect that revokes it, so a re-run of the
  // effect (StrictMode in dev runs mount → cleanup → mount) mints a fresh one
  // rather than handing back a URL its own cleanup just revoked — a memoised
  // URL showed as a broken image on every other card.
  useEffect(
    () => {
      const next = blob ? URL.createObjectURL( blob ) : null;

      // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL's lifetime is this effect's
      setUrl( next );

      return () => {
        if ( next ) {
          URL.revokeObjectURL( next );
        }
      };
    },
    [
      blob
    ]
  );

  return url;
}

/** What the card prints when no title was given. */
export function displayTitle( entry: Pick<GalleryEntry, "title" | "name"> ): string {
  return entry.title || formatSketchTitle( entry.name );
}

/**
 * One kept piece: the thumbnail at the canvas's own aspect ratio (so a Reel
 * and a square read as what they are), the title, the sketch, the date. The
 * whole thumbnail opens the piece; the title is renamed in place (click the
 * pencil, Enter commits, Escape reverts, blur commits) and the trash asks
 * once. Thumbnail-covering controls reveal on hover as the slide tiles do;
 * the text row's actions stay visible, as the layer rows' do.
 */
export default function GalleryCard( {
  entry,
  onOpen,
  onRename,
  onRemove
}: {
  entry: GalleryEntry;
  onOpen: ( entry: GalleryEntry ) => void;
  onRename: ( entry: GalleryEntry, title: string ) => void;
  onRemove: ( entry: GalleryEntry ) => void;
} ) {
  const thumbnail = useObjectUrl( entry.thumbnail );
  const [
    editing,
    setEditing
  ] = useState( false );
  const [
    draft,
    setDraft
  ] = useState( entry.title );
  const title = displayTitle( entry );

  const commit = () => {
    setEditing( false );
    if ( draft.trim() !== entry.title ) {
      onRename(
        entry,
        draft
      );
    }
  };

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-foreground/20"
      data-gallery-entry={ entry.id }
      data-sketch={ entry.sketch }
    >
      <button
        type="button"
        onClick={ () => onOpen( entry ) }
        title={ `Open ${ title } in the studio` }
        aria-label={ `Open ${ title } in the studio` }
        className="relative block w-full overflow-hidden bg-hover/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        style={ {
          aspectRatio: `${ entry.width } / ${ entry.height }`
        } }
      >
        {thumbnail ? (

          <img
            src={ thumbnail }
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-foreground/30">
            <ImageOff className="h-6 w-6" />
          </span>
        )}

        <span className="pointer-events-none absolute left-1.5 top-1.5 flex flex-wrap gap-1">
          <span className="glass rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/80">
            {ORIGIN_LABEL[ entry.origin ]}
          </span>
          {entry.hadAssets && (
            <span
              className="glass rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/80"
              title="This piece used uploaded files, which the gallery does not keep: they will be missing when it reopens"
            >
              had assets
            </span>
          )}
        </span>
      </button>

      <div className="flex min-w-0 items-start gap-1 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={ draft }
              placeholder={ formatSketchTitle( entry.name ) }
              aria-label="Title"
              onChange={ ( event ) => setDraft( event.target.value ) }
              onBlur={ commit }
              onKeyDown={ ( event ) => {
                if ( event.key === "Enter" ) {
                  commit();
                } else if ( event.key === "Escape" ) {
                  setDraft( entry.title );
                  setEditing( false );
                }
              } }
              className="w-full rounded-md border border-border bg-background px-1.5 py-0.5 text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-focus"
            />
          ) : (
            <p
              className={ clsx(
                "truncate text-sm font-medium",
                entry.title ? "text-foreground" : "text-foreground/80"
              ) }
              title={ title }
            >
              {title}
            </p>
          )}
          <p className="truncate font-mono text-[10.5px] text-foreground/50" title={ entry.sketch }>
            {entry.sketch}
          </p>
          <p className="text-[11px] tabular-nums text-foreground/60">
            <time dateTime={ new Date( entry.at ).toISOString() }>
              {dateFormat.format( entry.at )}
            </time>
            <span className="text-foreground/40"> · {entry.width}×{entry.height}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={ () => {
            setDraft( entry.title );
            setEditing( true );
          } }
          title="Rename"
          aria-label={ `Rename ${ title }` }
          className="shrink-0 rounded-md p-1.5 text-foreground/60 transition-colors hover:bg-hover hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={ () => onRemove( entry ) }
          title="Delete from the gallery"
          aria-label={ `Delete ${ title }` }
          className="shrink-0 rounded-md p-1.5 text-foreground/60 transition-colors hover:bg-red-500/15 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}
