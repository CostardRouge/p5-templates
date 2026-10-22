"use client";

import React, {
  useMemo, useRef, useState
} from "react";
import {
  Download, Images, Search, Upload
} from "lucide-react";
import {
  useRouter
} from "next/navigation";

import {
  HIDDEN_FILE_INPUT_CLASS
} from "@/components/hiddenFileInput";
import {
  MenuBarSlot
} from "@/components/MenuBarPortal";
import Toast from "@/components/Toast";
import {
  triggerDownload
} from "@/lib/export/download";
import {
  exportGallery, galleryArchiveFileName, importGallery
} from "@/lib/gallery/archive";
import {
  galleryEntryHref, stageGalleryEntry
} from "@/lib/gallery/open";
import {
  getGalleryStore
} from "@/lib/gallery/store";
import type {
  GalleryEntry
} from "@/lib/gallery/types";
import GalleryCard, {
  displayTitle
} from "./GalleryCard";
import {
  useGallery
} from "./useGallery";

const GRID_CLASS =
  "grid grid-cols-2 items-start gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

const INPUT_CLASS =
  "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-foreground/40 focus:outline-hidden focus:ring-1 focus:ring-focus";

/**
 * The gallery: every piece kept in THIS browser (`src/lib/gallery/`), newest
 * first, filtered by sketch or by a word in the title. Opening a card relaunches
 * the sketch with exactly that document, the way the listing's "Import .json"
 * does. Nothing here talks to a server, so the page works on a static
 * deployment and `/recordings` (the backend's jobs) stays what it was.
 */
export default function GalleryPage() {
  const router = useRouter();
  const {
    entries, error
  } = useGallery();
  const [
    sketchFilter,
    setSketchFilter
  ] = useState( "" );
  const [
    search,
    setSearch
  ] = useState( "" );
  const [
    toast,
    setToast
  ] = useState<{ message: string;
    type: "success" | "error" | "info" } | null>( null );

  const sketches = useMemo(
    () => [
      ...new Set( ( entries ?? [] ).map( ( entry ) => entry.sketch ) )
    ].sort(),
    [
      entries
    ]
  );

  const shown = useMemo(
    () => {
      const needle = search.trim().toLowerCase();

      return ( entries ?? [] ).filter( ( entry ) => ( !sketchFilter || entry.sketch === sketchFilter ) &&
        ( !needle || displayTitle( entry ).toLowerCase()
          .includes( needle ) || entry.sketch.toLowerCase().includes( needle ) ) );
    },
    [
      entries,
      sketchFilter,
      search
    ]
  );

  const handleOpen = ( entry: GalleryEntry ) => {
    if ( !stageGalleryEntry( entry ) ) {
      setToast( {
        message: "Could not hand the options over (storage unavailable) — the sketch opens with its defaults.",
        type: "error"
      } );
    }
    router.push( galleryEntryHref( entry ) );
  };

  const handleRename = async(
    entry: GalleryEntry, title: string
  ) => {
    await getGalleryStore().rename(
      entry.id,
      title
    );
  };

  const handleRemove = async( entry: GalleryEntry ) => {
    if ( !window.confirm( `Delete "${ displayTitle( entry ) }" from the gallery? Its options and thumbnail are lost.` ) ) {
      return;
    }
    await getGalleryStore().remove( entry.id );
  };

  const importInputRef = useRef<HTMLInputElement>( null );
  const [
    archiving,
    setArchiving
  ] = useState( false );

  /** The whole gallery as one JSON file, through the browser's download. */
  const handleExportArchive = async() => {
    setArchiving( true );
    try {
      triggerDownload(
        await exportGallery( getGalleryStore() ),
        galleryArchiveFileName()
      );
    } catch( caught ) {
      setToast( {
        message: `The archive could not be written: ${ caught instanceof Error ? caught.message : String( caught ) }`,
        type: "error"
      } );
    } finally {
      setArchiving( false );
    }
  };

  const handleImportArchive = async( event: React.ChangeEvent<HTMLInputElement> ) => {
    const file = event.target.files?.[ 0 ];

    event.target.value = "";
    if ( !file ) {
      return;
    }
    setArchiving( true );
    try {
      const outcome = await importGallery(
        getGalleryStore(),
        await file.text()
      );

      setToast( {
        message: `${ outcome.added } ${ outcome.added === 1 ? "piece" : "pieces" } added${ outcome.skipped ? `, ${ outcome.skipped } already here` : "" }${ outcome.pruned ? `, ${ outcome.pruned } oldest pruned` : "" }.`,
        type: "success"
      } );
    } catch( caught ) {
      setToast( {
        message: `Nothing imported — ${ caught instanceof Error ? caught.message : String( caught ) }`,
        type: "error"
      } );
    } finally {
      setArchiving( false );
    }
  };

  const total = entries?.length ?? 0;
  const hasFilters = sketchFilter !== "" || search.trim() !== "";
  const ARCHIVE_BUTTON = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40";

  return (
    <div className="space-y-3 p-3 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <MenuBarSlot />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">Gallery</h1>
            <p className="mt-0.5 text-xs text-foreground/60 sm:mt-1 sm:text-sm">
              {entries === null
                ? "Loading…"
                : `${ total } ${ total === 1 ? "piece" : "pieces" } kept in this browser${ hasFilters ? ` · ${ shown.length } shown` : "" }`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-40">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/40" />
            <input
              type="search"
              aria-label="Search the gallery"
              placeholder="Search titles…"
              value={ search }
              onChange={ ( event ) => setSearch( event.target.value ) }
              className={ `${ INPUT_CLASS } w-full pl-8` }
            />
          </label>
          <select
            aria-label="Filter by sketch"
            value={ sketchFilter }
            onChange={ ( event ) => setSketchFilter( event.target.value ) }
            className={ `${ INPUT_CLASS } max-w-full` }
          >
            <option value="">Every sketch</option>
            {sketches.map( ( sketch ) => (
              <option key={ sketch } value={ sketch }>{sketch}</option>
            ) )}
          </select>

          {/* The backup: the whole gallery as one JSON file, thumbnails
              inline, and back — merged, never duplicated. The gallery lives
              in this browser's storage only, and a cleared site data takes
              it with it. */}
          <button
            type="button"
            onClick={ () => void handleExportArchive() }
            disabled={ archiving || total === 0 }
            title="Download every piece — options and thumbnails — as one JSON file"
            className={ ARCHIVE_BUTTON }
          >
            <Download className="h-3.5 w-3.5" />
            Export archive
          </button>
          <input
            ref={ importInputRef }
            type="file"
            accept=".json,application/json"
            aria-label="Gallery archive file"
            onChange={ ( event ) => void handleImportArchive( event ) }
            className={ HIDDEN_FILE_INPUT_CLASS }
          />
          <button
            type="button"
            onClick={ () => importInputRef.current?.click() }
            disabled={ archiving }
            title="Merge an exported gallery archive into this one"
            className={ ARCHIVE_BUTTON }
          >
            <Upload className="h-3.5 w-3.5" />
            Import archive
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-border px-3 py-2 text-xs text-foreground/80">
          The gallery could not be read: {error}
        </p>
      )}

      {entries !== null && shown.length === 0 && (
        <div className="py-8 text-center sm:py-12">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-hover/50 sm:mb-4 sm:h-16 sm:w-16">
            <Images className="h-6 w-6 text-foreground/40 sm:h-8 sm:w-8" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-foreground sm:text-lg">
            {hasFilters ? "Nothing matches" : "Nothing kept yet"}
          </h3>
          <p className="text-xs text-foreground/60 sm:text-sm">
            {hasFilters
              ? "Try another sketch or clear the search."
              : "Export a piece, or press the bookmark in the studio's transport bar, and it lands here with its options and a thumbnail."}
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <div className={ GRID_CLASS }>
          {shown.map( ( entry ) => (
            <GalleryCard
              key={ entry.id }
              entry={ entry }
              onOpen={ handleOpen }
              onRename={ (
                target, title
              ) => void handleRename(
                target,
                title
              ) }
              onRemove={ ( target ) => void handleRemove( target ) }
            />
          ) )}
        </div>
      )}

      {toast && (
        <Toast
          message={ toast.message }
          type={ toast.type }
          onClose={ () => setToast( null ) }
        />
      )}
    </div>
  );
}
