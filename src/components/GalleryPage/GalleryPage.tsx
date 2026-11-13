"use client";

import React, {
  useCallback, useEffect, useMemo, useRef, useState
} from "react";
import clsx from "clsx";
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
  AHEAD_WEEKS, addDays, BACK_WEEKS, freeSlots, mondayOf, monthOf, monthsBetween, shiftMonth, type Month
} from "@/lib/gallery/calendar";
import {
  galleryEntryHref, stageGalleryEntry
} from "@/lib/gallery/open";
import {
  buildSends, byDay, foreignSends, filterCounts, PIECE_FILTERS, pieceFilterOf, sendDay, sendsByPiece, type GallerySend, type PieceFilter
} from "@/lib/gallery/sends";
import {
  getGalleryStore
} from "@/lib/gallery/store";
import type {
  GalleryEntry
} from "@/lib/gallery/types";
import {
  writeGalleryCookie, type GalleryView
} from "@/lib/gallery/view";
import {
  postizHome
} from "@/lib/postiz/client";
import {
  forgetPosts
} from "@/lib/postiz/publishStore";
import {
  localDay
} from "@/lib/postiz/rhythm";
import GalleryCard, {
  displayTitle
} from "./GalleryCard";
import {
  MonthView, ViewSwitcher, WeekView
} from "./GalleryViews";
import {
  itemTarget, type CalendarItem, type SheetTarget
} from "./items";
import SketchSheet from "./SketchSheet";
import {
  useGallery
} from "./useGallery";
import {
  useGalleryPosts
} from "./useGalleryPosts";

const GRID_CLASS =
  "grid grid-cols-2 items-start gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

const INPUT_CLASS =
  "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-foreground/40 focus:outline-hidden focus:ring-1 focus:ring-focus";

/** The browser's own zone, or null where `Intl` cannot say. */
function browserZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * The gallery: every piece kept in THIS browser (`src/lib/gallery/`) and —
 * lab 3 — what each became on the networks through his Postiz, in ONE of
 * three views, Month (the default), Week or Grid, remembered by a cookie so
 * the server paints the page in its final view (`view.ts`). Everything that
 * loads late (IndexedDB, Postiz) lands in frames already sized for it: a
 * fixed six-week month, a week whose days only grow downwards at the page's
 * end, cards whose posts line holds its place. A click on a piece, a tile or
 * a day's item opens the sketch's sheet.
 */
export default function GalleryPage( {
  initialView,
  initialTimeZone,
  initialToday
}: {
  initialView: GalleryView;
  initialTimeZone: string;
  /** Today in `initialTimeZone`, `YYYY-MM-DD`, as the server saw it. */
  initialToday: string;
} ) {
  const router = useRouter();
  const {
    entries, error
  } = useGallery();
  const gp = useGalleryPosts();
  const [
    view,
    setView
  ] = useState<GalleryView>( initialView );
  const [
    tz,
    setTz
  ] = useState( initialTimeZone );
  const [
    today,
    setToday
  ] = useState( initialToday );
  const [
    now
  ] = useState( () => Date.now() );
  const [
    month,
    setMonth
  ] = useState<Month>( () => monthOf( initialToday ) );
  const [
    weekOffset,
    setWeekOffset
  ] = useState( 0 );
  const [
    chip,
    setChip
  ] = useState<PieceFilter>( "all" );
  const [
    sketchFilter,
    setSketchFilter
  ] = useState( "" );
  const [
    search,
    setSearch
  ] = useState( "" );
  const [
    sheet,
    setSheet
  ] = useState<SheetTarget | null>( null );
  const [
    toast,
    setToast
  ] = useState<{ message: string;
    type: "success" | "error" | "info" } | null>( null );

  const closeSheet = useCallback(
    () => setSheet( null ),
    []
  );

  // The calendars' zone: the rhythm's once a Postiz is kept, else the
  // browser's — said to the server through the cookie for the next visit.
  const zone = gp.conn?.rhythm.timeZone ?? null;

  useEffect(
    () => {
      const next = zone ?? browserZone() ?? initialTimeZone;

      if ( next !== tz ) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the client's own zone, once known
        setTz( next );
        setToday( localDay(
          new Date(),
          next
        ) );
      }

      writeGalleryCookie( {
        view,
        timeZone: next
      } );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the cookie follows the zone; the view writes it itself
    [
      zone
    ]
  );

  const chooseView = ( next: GalleryView ) => {
    setView( next );
    writeGalleryCookie( {
      view: next,
      timeZone: tz
    } );
  };

  const all = useMemo(
    () => entries ?? [],
    [
      entries
    ]
  );

  const sketches = useMemo(
    () => [
      ...new Set( all.map( ( entry ) => entry.sketch ) )
    ].sort(),
    [
      all
    ]
  );

  const needle = search.trim().toLowerCase();
  const matchesSketch = useCallback(
    (
      sketchKey: string, title = ""
    ) => {
      const name = sketchKey.split( "/" )[ 1 ] ?? sketchKey;

      if ( sketchFilter && !sketchFilter.endsWith( `/${ name }` ) && sketchFilter !== name ) {
        return false;
      }

      return !needle || title.toLowerCase().includes( needle ) || sketchKey.toLowerCase().includes( needle );
    },
    [
      sketchFilter,
      needle
    ]
  );

  const shownPieces = useMemo(
    () => all.filter( ( entry ) => matchesSketch(
      `${ entry.engine }/${ entry.name }`,
      displayTitle( entry )
    ) ),
    [
      all,
      matchesSketch
    ]
  );

  // This browser's sends, and (Q3) Sketchbook's posts sent from another
  // device, known by the sketch's link in their caption.
  const sends = useMemo(
    () => [
      ...buildSends( {
        publications: gp.publications,
        posts: gp.posts,
        channels: gp.conn?.channels ?? [],
        entries: all,
        now
      } ),
      ...( gp.posts ? foreignSends(
        gp.posts,
        gp.publications
      ) : [] )
    ].sort( (
      a, b
    ) => b.at - a.at ),
    [
      gp.publications,
      gp.posts,
      gp.conn?.channels,
      all,
      now
    ]
  );
  const byPiece = useMemo(
    () => sendsByPiece( sends ),
    [
      sends
    ]
  );
  const entryById = useMemo(
    () => new Map( all.map( ( e ) => [
      e.id,
      e
    ] ) ),
    [
      all
    ]
  );

  // Without a Postiz the calendars are the archive's: each piece on the day it was kept.
  const piecesMode = !gp.conn;
  const sendsKnown = entries !== null && ( !gp.conn || gp.posts !== null || gp.error !== null );
  // Nothing is laid on a day before everything it depends on is read: what
  // lands then lands as NEW tiles, and a tile never changes its state words
  // (and so its width) under the eye.
  const items = useMemo<CalendarItem[]>(
    () => !sendsKnown ? [] : piecesMode
      ? shownPieces.map( ( entry ) => ( {
        kind: "piece",
        key: entry.id,
        at: entry.at,
        entry
      } ) )
      : sends.filter( ( send ) => {
        const entry = send.pieceId ? entryById.get( send.pieceId ) : undefined;

        return matchesSketch(
          send.sketchKey,
          entry ? displayTitle( entry ) : ""
        );
      } ).map( ( send ) => ( {
        kind: "send",
        key: send.key,
        at: send.at,
        send,
        entry: send.pieceId ? entryById.get( send.pieceId ) ?? null : null
      } ) ),
    [
      sendsKnown,
      piecesMode,
      shownPieces,
      sends,
      entryById,
      matchesSketch
    ]
  );
  const itemsByDay = useMemo(
    () => byDay(
      [
        ...items
      ].sort( (
        a, b
      ) => a.at - b.at ),
      ( item ) => item.kind === "send" ? sendDay(
        item.send,
        tz
      ) : localDay(
        new Date( item.at ),
        tz
      )
    ),
    [
      items,
      tz
    ]
  );

  const monday = mondayOf(
    today,
    weekOffset
  );
  const free = useMemo(
    () => gp.conn && gp.posts ? freeSlots(
      gp.conn.rhythm,
      gp.posts,
      monday,
      new Date( now )
    ) : new Map<string, Date[]>(),
    [
      gp.conn,
      gp.posts,
      monday,
      now
    ]
  );

  // With a Postiz, the calendars page through what was read (5 weeks back, 8 ahead); the rest is Postiz's.
  const thisMonth = monthOf( today );
  const firstMonth = monthOf( addDays(
    today,
    -BACK_WEEKS * 7
  ) );
  const lastMonth = monthOf( addDays(
    today,
    AHEAD_WEEKS * 7
  ) );
  const bounded = Boolean( gp.conn );

  const counts = useMemo(
    () => filterCounts(
      shownPieces.map( ( e ) => e.id ),
      byPiece
    ),
    [
      shownPieces,
      byPiece
    ]
  );
  const gridPieces = chip === "all" ? shownPieces : shownPieces.filter( ( e ) => pieceFilterOf( byPiece.get( e.id ) ) === chip );

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

  /** What is not out, deleted in Postiz one post at a time; those gone are forgotten here. */
  const takeBack = gp.client ? async(
    send: GallerySend, postIds: string[]
  ) => {
    const gone: string[] = [];
    let failure: unknown = null;

    for ( const id of postIds ) {
      try {
        await gp.client!.deletePost( id );
        gone.push( id );
      } catch( caught ) {
        failure = caught;
      }
    }

    if ( gone.length ) {
      forgetPosts(
        send.sketchKey,
        gone
      );
    }

    await gp.reload();

    if ( failure ) {
      throw failure;
    }
  } : null;

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

  const total = all.length;
  const hasFilters = sketchFilter !== "" || needle !== "";
  const ARCHIVE_BUTTON = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40";

  // ONE status line, whatever happens: what loads late is said here, never in a block that appears.
  const postizWords = !gp.conn
    ? "connect your Postiz (menu › Publishing) to see their posts"
    : gp.error
      ? `your Postiz did not answer: ${ gp.error }`
      : gp.posts === null ? "asking your Postiz…" : "posts read from your Postiz";
  const status = entries === null
    ? "Loading…"
    : `${ total } ${ total === 1 ? "piece" : "pieces" } kept in this browser${ hasFilters ? ` · ${ shownPieces.length } shown` : "" } · ${ postizWords }`;
  const postizUrl = gp.conn ? postizHome( gp.conn.apiBase ) : null;
  const pick = ( item: CalendarItem ) => setSheet( itemTarget( item ) );

  return (
    <div className="space-y-3 p-3 sm:space-y-5 sm:p-6" data-gallery-ready={ sendsKnown ? "true" : "false" }>
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <MenuBarSlot />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">Gallery</h1>
            <p className="mt-0.5 truncate text-xs text-foreground/60 sm:mt-1 sm:text-sm" title={ status } data-gallery-status>
              {status}
            </p>
          </div>
        </div>

        {/* Two rows on a phone, one on a wide screen — every width fixed or
            flexed, never sized by its content: the sketch list fills in after
            the archive is read, and a select sized by its longest option
            pushed the whole toolbar onto a new line on a phone (CLS 0.2). */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ViewSwitcher view={ view } onChange={ chooseView } />
            <label className="relative min-w-0 flex-1">
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
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <select
              aria-label="Filter by sketch"
              value={ sketchFilter }
              onChange={ ( event ) => setSketchFilter( event.target.value ) }
              className={ `${ INPUT_CLASS } w-0 min-w-0 flex-1 lg:w-56 lg:flex-none` }
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
              <span className="max-sm:sr-only">Export archive</span>
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
              <span className="max-sm:sr-only">Import archive</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-border px-3 py-2 text-xs text-foreground/80">
          The gallery could not be read: {error}
        </p>
      )}

      {view === "month" && (
        <MonthView
          month={ month }
          today={ today }
          tz={ tz }
          byDay={ itemsByDay }
          pieces={ piecesMode }
          canPrev={ !bounded || monthsBetween(
            firstMonth,
            month
          ) > 0 }
          canNext={ !bounded || monthsBetween(
            month,
            lastMonth
          ) > 0 }
          onMonth={ ( delta ) => setMonth( ( m ) => shiftMonth(
            m,
            delta
          ) ) }
          onToday={ () => setMonth( thisMonth ) }
          onPick={ pick }
          loading={ !sendsKnown }
        />
      )}

      {view === "week" && (
        <WeekView
          monday={ monday }
          today={ today }
          tz={ tz }
          byDay={ itemsByDay }
          free={ free }
          pieces={ piecesMode }
          offset={ weekOffset }
          canPrev={ !bounded || weekOffset > -BACK_WEEKS }
          canNext={ !bounded || weekOffset < AHEAD_WEEKS }
          onWeek={ ( delta ) => setWeekOffset( ( o ) => delta === null ? 0 : o + delta ) }
          onPick={ pick }
          postizUrl={ postizUrl }
        />
      )}

      {view === "grid" && (
        <section aria-label="Pieces" className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="Filter by what became of them" className="flex flex-wrap gap-1.5">
            {PIECE_FILTERS.map( ( f ) => (
              <button
                key={ f.id }
                type="button"
                role="radio"
                aria-checked={ chip === f.id }
                data-chip={ f.id }
                onClick={ () => setChip( f.id ) }
                className={ clsx(
                  "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
                  chip === f.id ? "border-transparent bg-foreground text-background" : "border-border bg-background text-foreground/70 hover:text-foreground"
                ) }
              >
                {f.label}
                <span className="inline-block min-w-[3ch] text-left font-mono text-[10.5px] tabular-nums opacity-70">
                  {entries === null || ( f.id !== "all" && !sendsKnown ) ? "" : counts[ f.id ]}
                </span>
              </button>
            ) )}
          </div>

          {entries !== null && gridPieces.length === 0 && (
            <div className="py-8 text-center sm:py-12">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-hover/50 sm:mb-4 sm:h-16 sm:w-16">
                <Images className="h-6 w-6 text-foreground/40 sm:h-8 sm:w-8" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-foreground sm:text-lg">
                {hasFilters || chip !== "all" ? "Nothing matches" : "Nothing kept yet"}
              </h3>
              <p className="text-xs text-foreground/60 sm:text-sm">
                {hasFilters || chip !== "all"
                  ? "Try another filter, another sketch or clear the search."
                  : "Export a piece, or press the bookmark in the studio's transport bar, and it lands here with its options and a thumbnail."}
              </p>
            </div>
          )}

          {gridPieces.length > 0 && (
            <div className={ GRID_CLASS }>
              {gridPieces.map( ( entry ) => (
                <GalleryCard
                  key={ entry.id }
                  entry={ entry }
                  sends={ sendsKnown ? byPiece.get( entry.id ) ?? [] : [] }
                  sendsKnown={ sendsKnown }
                  tz={ tz }
                  now={ now }
                  onOpen={ ( target ) => setSheet( {
                    sketchKey: `${ target.engine }/${ target.name }`,
                    pieceId: target.id,
                    sendKey: null
                  } ) }
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
        </section>
      )}

      {sheet && (
        <SketchSheet
          target={ sheet }
          entries={ all }
          sends={ sends }
          tz={ tz }
          postizUrl={ postizUrl }
          onClose={ closeSheet }
          onOpenPiece={ handleOpen }
          onOpenSketch={ ( sketchKey ) => router.push( `/sketches/${ sketchKey }` ) }
          onTakeBack={ takeBack }
          onSendAgain={ null }
        />
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
