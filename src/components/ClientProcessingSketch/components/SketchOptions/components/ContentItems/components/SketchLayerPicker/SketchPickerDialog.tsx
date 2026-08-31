"use client";

import React from "react";
import clsx from "clsx";
import {
  Search, X
} from "lucide-react";
import {
  createPortal
} from "react-dom";

import {
  listEmbeddableSketches, type SketchChoice
} from "@/lib/sketchLayerCatalogue";

type SketchPickerDialogProps = {
  open: boolean;
  /** Highlighted on open, so "change the sketch" starts from where you are. */
  value?: string;
  onPick: ( choice: SketchChoice ) => void;
  onClose: () => void;
};

type SketchPickerBodyProps = Omit<SketchPickerDialogProps, "open">;

/** Rows of thumbnails, grouped the way the catalogue is: one band per category. */
type CategoryGroup = {
  label: string;
  choices: SketchChoice[];
};

function groupByCategory( choices: SketchChoice[] ): CategoryGroup[] {
  const groups = new Map<string, SketchChoice[]>();

  choices.forEach( ( choice ) => {
    const label = choice.category ?? "uncategorised";
    const existing = groups.get( label );

    if ( existing ) {
      existing.push( choice );
    } else {
      groups.set(
        label,
        [
          choice
        ]
      );
    }
  } );

  return [
    ...groups.entries()
  ].map( ( [
    label,
    grouped
  ] ) => ( {
    label,
    choices: grouped
  } ) );
}

/**
 * The sketch chooser for an embedded-sketch layer: a searchable grid of the
 * catalogue's own thumbnails, grouped by category.
 *
 * It is a modal rather than a select for one reason — a sketch is a *look*, and
 * 298 names in a dropdown say nothing about which one. The thumbnails already
 * exist (the gallery renders the same files), so the picker costs no new asset
 * pipeline.
 *
 * The same dialog serves both entry points: the palette's "Sketch" tile opens
 * it before creating the layer, and the layer's own "Sketch" field opens it to
 * swap what an existing layer runs.
 */
export default function SketchPickerDialog( {
  open,
  ...rest
}: SketchPickerDialogProps ) {
  // The body mounts with the dialog rather than rendering hidden: its search
  // term then starts empty every time, with no effect resetting it, and the
  // portal is only reached in the browser (both entry points start closed).
  if ( !open ) {
    return null;
  }

  return <SketchPickerBody { ...rest } />;
}

function SketchPickerBody( {
  value,
  onPick,
  onClose
}: SketchPickerBodyProps ) {
  const [
    query,
    setQuery
  ] = React.useState( "" );

  React.useEffect(
    () => {
      const onKeyDown = ( event: KeyboardEvent ) => {
        if ( event.key === "Escape" ) {
          event.stopPropagation();
          onClose();
        }
      };

      window.addEventListener(
        "keydown",
        onKeyDown
      );

      return () => window.removeEventListener(
        "keydown",
        onKeyDown
      );
    },
    [
      onClose
    ]
  );

  const groups = React.useMemo(
    () => {
      const needle = query.trim().toLowerCase();
      const choices = needle
        ? listEmbeddableSketches().filter( ( choice ) => choice.path.toLowerCase()
          .includes( needle ) )
        : listEmbeddableSketches();

      return groupByCategory( choices );
    },
    [
      query
    ]
  );

  const total = groups.reduce(
    (
      count, group
    ) => count + group.choices.length,
    0
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a sketch"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={ onClose }
      />

      <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-theme bg-background shadow-2xl">
        <div className="flex items-center gap-2 border-b border-theme px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Choose a sketch</h2>

          <span className="text-xs tabular-nums text-label/60">{total}</span>

          <div className="relative ml-auto flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-label" />
            <input
              type="search"
              value={ query }
              autoFocus
              onChange={ ( event ) => setQuery( event.target.value ) }
              placeholder="Filter by name or category"
              className={ clsx(
                "w-full rounded-lg border border-theme bg-hover/30 py-1.5 pl-7 pr-2 text-xs text-foreground",
                "focus:outline-none focus:ring-1 focus:ring-focus"
              ) }
            />
          </div>

          <button
            type="button"
            onClick={ onClose }
            aria-label="Close"
            className="rounded-lg p-1.5 text-label transition-colors hover:bg-hover hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {total === 0 && (
            <p className="py-8 text-center text-xs text-label">
              No sketch matches “{query}”.
            </p>
          )}

          {groups.map( ( group ) => (
            <div key={ group.label } className="flex flex-col gap-2">
              <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-label/70">
                {group.label}
              </span>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {group.choices.map( ( choice ) => (
                  <button
                    key={ choice.path }
                    type="button"
                    onClick={ () => onPick( choice ) }
                    title={ choice.path }
                    className={ clsx(
                      "group flex flex-col overflow-hidden rounded-lg border text-left transition",
                      "hover:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-focus",
                      choice.path === value
                        ? "border-focus ring-1 ring-focus"
                        : "border-theme"
                    ) }
                  >
                    <img
                      src={ choice.thumbnail }
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/5] w-full bg-hover object-cover"
                    />
                    <span className="truncate px-2 py-1.5 text-[11px] text-foreground/80 group-hover:text-foreground">
                      {choice.name}
                    </span>
                  </button>
                ) )}
              </div>
            </div>
          ) )}
        </div>
      </div>
    </div>,
    document.body
  );
}
