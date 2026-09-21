"use client";

import React, {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore
} from "react";
import {
  Plus
} from "lucide-react";
import {
  Menu, MenuButton, MenuItem, MenuItems
} from "@headlessui/react";
import {
  runExportBatch, type ExportArtifact, type ExportItemState
} from "@/lib/export/runExportBatch";
import {
  downloadArtifacts,
  isDelivered,
  saveArtifacts,
  shouldDeferDelivery,
  type SaveOutcome
} from "@/lib/export/delivery";
import {
  addVariant,
  duplicateVariantById,
  ensureVariants,
  getVariantSnapshot,
  patchVariant,
  removeVariant,
  subscribeVariants
} from "@/lib/export/variantStore";
import {
  hasMixedSlideSizes,
  nativeFramerateFor,
  nativeSizeFor,
  resolveSlideIndices,
  slugify,
  VARIANT_PRESETS,
  type ExportVariant
} from "@/lib/export/variants";
import useSketch from "../../../SketchProvider/hooks/useSketch";
import ExportPreview from "./components/ExportPreview";
import VariantTableRow, {
  VARIANT_GRID
} from "./components/VariantTableRow";
import type {
  RecordingFormat
} from "@/engines/recording";
import type {
  SketchOption
} from "@/types/sketch.types";

type ExportPanelProps = {
  name: string;
  options: SketchOption;
  activeSlideIndex: number | undefined;
  /** How many produced files are still unsaved, so the dialog can guard its
   *  close — the panel unmounts with it and the blobs die there. */
  onPendingChange?: ( count: number ) => void;
};

/** One variant's output, plus the name it takes when zipped into one file. */
type VariantOutput = {
  artifacts: ExportArtifact[];
  bundleFileName: string;
};

const FALLBACK_FORMATS: RecordingFormat[] = [
  "mp4",
  "webm",
  "gif"
];

const HEAD_CELL =
  "px-2.5 text-left text-[9.5px] font-semibold uppercase tracking-[0.09em] text-label";

/** What to say when a save did not put anything anywhere. */
const SAVE_NOTICE: Record<string, string> = {
  dismissed: "Nothing saved — you dismissed the sheet.",
  busy: "A share sheet is already open. Close it and try again.",
  failed: "Those files could not be saved."
};

/**
 * The export surface: one row per variant, every setting editable in place.
 *
 * The batch IS the table. An earlier split — a list of variants beside an
 * editor for the selected one — showed one variant's settings and summarised
 * the other two, which is the wrong shape for a tool whose whole job is
 * producing several outputs at once. Here all of them are readable together,
 * nothing is stated twice, and a column that does not apply to a variant says
 * so with a dash instead of offering a control that would be ignored.
 *
 * The row doubles as the run queue: progress is the row inverting under an ink
 * wipe, a phase meter under its status and a slide counter in its Slides cell,
 * so what is happening is attached to the variant it happens to. The footer's
 * own 2px bar is the batch's, which a per-row reading cannot answer.
 *
 * The same table serves every viewport — a phone scrolls it sideways rather
 * than folding into cards, so there is one layout to reason about and one set
 * of controls. Its rows grow to a thumb's height below `md`.
 *
 * **The panel also owns delivery**, which the runner used to do itself. On a
 * device with a share sheet nothing is delivered automatically: the run ends
 * holding its files and the footer turns into a save action, because several
 * unattended downloads there raise modal prompts that overwrite one another and
 * report nothing back. See `src/lib/export/delivery.ts`.
 */
export default function ExportPanel( {
  name,
  options,
  activeSlideIndex,
  onPendingChange
}: ExportPanelProps ) {
  const [
    {
      engine, engineId
    }
  ] = useSketch();

  const sketchKey = `${ engineId }/${ name }`;

  // Seed before the first subscription read so the table is never momentarily
  // empty on open.
  ensureVariants( sketchKey );

  const snapshot = useSyncExternalStore(
    subscribeVariants,
    () => getVariantSnapshot( sketchKey ),
    () => getVariantSnapshot( sketchKey )
  );

  const [
    items,
    setItems
  ] = useState<ExportItemState[]>( [] );
  const [
    running,
    setRunning
  ] = useState( false );
  const [
    error,
    setError
  ] = useState<string | null>( null );

  // What each finished variant produced, kept so it can be previewed and — on
  // a deferred device — so it can still be saved after the run. ExportPanel is
  // mounted only while the dialog is open, so this dies with the dialog.
  const [
    outputs,
    setOutputs
  ] = useState<Record<string, VariantOutput>>( {} );
  const [
    saved,
    setSaved
  ] = useState<Record<string, SaveOutcome>>( {} );
  const [
    saving,
    setSaving
  ] = useState( false );
  const [
    notice,
    setNotice
  ] = useState<string | null>( null );
  const [
    previewing,
    setPreviewing
  ] = useState<string | null>( null );
  const abortRef = useRef<AbortController | null>( null );
  const scrollRef = useRef<HTMLDivElement | null>( null );

  /**
   * Publish how much of the table is off to the sides, as a `data-more`
   * attribute the edge fades key off.
   *
   * Written straight to the DOM rather than held in state: it fires on every
   * scroll frame, and a re-render per frame is precisely the cost this panel
   * has just been rid of. A `ResizeObserver` covers the other way the answer
   * changes — the dialog resizing, or a variant being added or removed.
   */
  useEffect(
    () => {
      const element = scrollRef.current;

      if ( !element ) {
        return;
      }

      const update = () => {
        const overflow = element.scrollWidth - element.clientWidth;
        const atStart = element.scrollLeft <= 1;
        const atEnd = element.scrollLeft >= overflow - 1;

        element.dataset.more = overflow <= 1
          ? "none"
          : atStart ? "right" : atEnd ? "left" : "both";
      };

      update();

      const observer = new ResizeObserver( update );

      observer.observe( element );
      element.addEventListener(
        "scroll",
        update,
        {
          passive: true
        }
      );

      return () => {
        observer.disconnect();
        element.removeEventListener(
          "scroll",
          update
        );
      };
    },
    []
  );

  /**
   * Whether this run holds its files back, decided ONCE from the first
   * variant's real files.
   *
   * Per-variant would be worse than either answer: a batch that downloads its
   * Reel and then silently keeps its square post is the confusing half-state.
   */
  const deferredRef = useRef<boolean | null>( null );

  const slideCount = Array.isArray( options.slides ) ? options.slides.length : 0;

  const supportedFormats = useMemo(
    () => {
      if ( !engine ) {
        return FALLBACK_FORMATS;
      }

      try {
        return engine.getRecordingCapabilities(
          options,
          activeSlideIndex
        ).supportedFormats;
      } catch {
        return FALLBACK_FORMATS;
      }
    },
    [
      engine,
      options,
      activeSlideIndex
    ]
  );

  /** The slides a variant covers — drives the delivery column, the file count
   *  and whether the size picker has to offer a reconciliation. */
  const slidesOf = useCallback(
    ( variant: ExportVariant ) => resolveSlideIndices(
      variant,
      slideCount,
      activeSlideIndex
    ),
    [
      slideCount,
      activeSlideIndex
    ]
  );

  const fileCount = snapshot.variants.reduce(
    (
      total, variant
    ) => {
      const span = slidesOf( variant ).length;

      return total + ( variant.delivery === "combined" && variant.kind === "video"
        ? 1
        : span );
    },
    0
  );

  /** Produced, but not yet anywhere the user can reach. */
  const unsaved = snapshot.variants
    .map( ( variant ) => ( {
      variant,
      output: outputs[ variant.id ]
    } ) )
    .filter( ( entry ): entry is {
      variant: ExportVariant;
      output: VariantOutput;
    } => Boolean( entry.output ) && !isDelivered( saved[ entry.variant.id ] ?? "failed" ) );

  const unsavedFileCount = unsaved.reduce(
    (
      total, entry
    ) => total + entry.output.artifacts.length,
    0
  );

  useEffect(
    () => onPendingChange?.( unsavedFileCount ),
    [
      unsavedFileCount,
      onPendingChange
    ]
  );

  // Whatever is still held when the panel goes away goes with it: tell the
  // dialog the count is zero so a later open does not inherit a stale guard.
  useEffect(
    () => () => onPendingChange?.( 0 ),
    [
      onPendingChange
    ]
  );

  const markSaved = (
    variantIds: string[], outcome: SaveOutcome
  ) => setSaved( ( current ) => ( {
    ...current,
    ...Object.fromEntries( variantIds.map( ( id ) => [
      id,
      outcome
    ] ) )
  } ) );

  const handleArtifacts = (
    variantId: string, produced: ExportArtifact[], bundleFileName: string
  ) => {
    setOutputs( ( current ) => ( {
      ...current,
      [ variantId ]: {
        artifacts: produced,
        bundleFileName
      }
    } ) );

    if ( deferredRef.current === null ) {
      deferredRef.current = shouldDeferDelivery( produced );
    }

    if ( deferredRef.current ) {
      return;
    }

    void downloadArtifacts(
      produced,
      bundleFileName
    ).then( ( outcome ) => markSaved(
      [
        variantId
      ],
      outcome
    ) );
  };

  const handleExport = async() => {
    if ( running || !engine || snapshot.variants.length === 0 ) {
      return;
    }

    const controller = new AbortController();

    abortRef.current = controller;
    setRunning( true );
    setError( null );
    setNotice( null );
    // A new run replaces the last one's results; holding both would pin two
    // batches' worth of blobs for no reason.
    setPreviewing( null );
    setOutputs( {} );
    setSaved( {} );
    deferredRef.current = null;

    try {
      await runExportBatch( {
        engine,
        options,
        sketchName: name,
        activeSlideIndex,
        variants: snapshot.variants,
        signal: controller.signal,
        onProgress: setItems,
        onArtifacts: handleArtifacts
      } );
    } catch( caught ) {
      // A cancel is a normal outcome, not a failure worth shouting about —
      // the per-row states already say what happened.
      if ( !( caught instanceof DOMException && caught.name === "AbortError" ) ) {
        setError( caught instanceof Error ? caught.message : String( caught ) );
      }
    } finally {
      abortRef.current = null;
      setRunning( false );
    }
  };

  /**
   * Every unsaved file, in one gesture.
   *
   * One share sheet carrying all of them is the whole point on a phone: iOS
   * offers "Save 3 Videos" straight to Photos, where three separate prompts
   * would have overwritten one another.
   */
  const handleSaveAll = async() => {
    if ( saving || unsaved.length === 0 ) {
      return;
    }

    setSaving( true );
    setNotice( null );

    try {
      const outcome = await saveArtifacts(
        unsaved.flatMap( ( entry ) => entry.output.artifacts ),
        name,
        `${ slugify( name ) || "sketch" }-export.zip`
      );

      if ( isDelivered( outcome ) ) {
        markSaved(
          unsaved.map( ( entry ) => entry.variant.id ),
          outcome
        );
      } else {
        setNotice( SAVE_NOTICE[ outcome ] ?? SAVE_NOTICE.failed );
      }
    } finally {
      setSaving( false );
    }
  };

  const stateFor = ( id: string ) => items.find( ( item ) => item.variantId === id );

  /**
   * How far the whole batch has got, 0-100.
   *
   * Averaging the variants' own percentages rather than counting finished ones
   * is what keeps it moving during the long one: a three-variant run that sat
   * at 0 / 33 / 67 told you nothing for minutes at a time.
   */
  const batchPercentage = items.length === 0
    ? 0
    : items.reduce(
      (
        sum, item
      ) => sum + ( item.status === "done" ? 100 : item.percentage ),
      0
    ) / items.length;

  const runningIndex = Math.max(
    0,
    items.findIndex( ( item ) => item.status === "running" )
  );

  const previewed = previewing ? outputs[ previewing ] : undefined;

  // The preview takes over the list's region rather than opening a second
  // modal: on a phone the dialog already owns the whole screen, and stacking a
  // surface over that fights the chrome instead of using it.
  if ( previewing && previewed && previewed.artifacts.length > 0 ) {
    return (
      <ExportPreview
        title={ snapshot.variants.find( ( variant ) => variant.id === previewing )?.name ?? "Export" }
        artifacts={ previewed.artifacts }
        bundleFileName={ previewed.bundleFileName }
        outcome={ saved[ previewing ] }
        onSaved={ ( outcome ) => {
          if ( isDelivered( outcome ) ) {
            markSaved(
              [
                previewing
              ],
              outcome
            );
          }
        } }
        onBack={ () => setPreviewing( null ) }
      />
    );
  }

  const rowProps = ( variant: ExportVariant ) => ( {
    variant,
    nativeSize: nativeSizeFor(
      options,
      activeSlideIndex
    ),
    nativeFramerate: nativeFramerateFor(
      options,
      activeSlideIndex
    ),
    slideCount,
    slideSpan: slidesOf( variant ).length,
    mixedSizes: hasMixedSlideSizes(
      variant,
      options,
      slidesOf( variant )
    ),
    supportedFormats,
    state: stateFor( variant.id ),
    running,
    delivered: isDelivered( saved[ variant.id ] ?? "failed" ),
    onPreview: outputs[ variant.id ]?.artifacts.length
      ? () => setPreviewing( variant.id )
      : undefined,
    removable: snapshot.variants.length > 1,
    onPatch: ( patch: Partial<ExportVariant> ) => patchVariant(
      sketchKey,
      variant.id,
      patch
    ),
    onDuplicate: () => duplicateVariantById(
      sketchKey,
      variant.id
    ),
    onRemove: () => removeVariant(
      sketchKey,
      variant.id
    )
  } );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Opaque, unlike the dialog's glass chrome around it: a table of small
          mono values with a sketch showing through is unreadable, and this is
          the region you actually read. The glass stays on the title bar and
          the footer, where it still frames the dialog against the canvas. */}
      {/* The one table, every viewport. A phone scrolls it sideways rather
          than folding it into cards: the six settings are the same on both,
          and the edge fades say when more of them are off to the side — which
          is the part a bare sideways scroll never admitted to.

          The fades are siblings of the scrolling region, not children of it:
          an absolutely positioned child of a scroll container is placed
          against that container's UNSCROLLED origin, so it would slide away
          with the content it is meant to be marking. */}
      <div className="relative flex min-h-0 flex-1">
        <div
          ref={ scrollRef }
          data-more="none"
          className="peer min-h-0 flex-1 overflow-auto bg-background"
        >
          <div role="table" aria-label="Export variants" className="min-w-[700px]">
            <div
              role="row"
              className={ `${ VARIANT_GRID } sticky top-0 z-10 h-8 items-center border-b border-theme bg-background` }
            >
              <div role="columnheader" className={ HEAD_CELL }>Variant</div>
              <div role="columnheader" className={ HEAD_CELL }>Size</div>
              <div role="columnheader" className={ HEAD_CELL }>Output</div>
              <div role="columnheader" className={ HEAD_CELL }>Rate</div>
              <div role="columnheader" className={ HEAD_CELL }>Slides</div>
              <div role="columnheader" className={ `${ HEAD_CELL } text-right` }>
                Delivers
              </div>
              <div role="columnheader" className="px-2">
                <span className="sr-only">Row actions</span>
              </div>
            </div>

            {snapshot.variants.map( ( variant ) => (
              <VariantTableRow key={ variant.id } { ...rowProps( variant ) } />
            ) )}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent opacity-0 transition-opacity motion-reduce:transition-none peer-data-[more=both]:opacity-100 peer-data-[more=left]:opacity-100"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent opacity-0 transition-opacity motion-reduce:transition-none peer-data-[more=both]:opacity-100 peer-data-[more=right]:opacity-100"
        />
      </div>

      {/* Adding a variant starts from a preset, never a blank row: a new
          variant needing four fields filled in before it does anything is not
          a starting point. Kept out of the scrolling region so it stays put
          while the table is scrolled sideways. */}
      <div className="border-t border-dashed border-theme">
        <Menu as="div" className="relative">
          <MenuButton
            disabled={ running }
            className="flex min-h-[44px] w-full items-center gap-1.5 px-2.5 py-2 text-left text-[11px] text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-40 md:min-h-0"
          >
            <Plus className="h-3 w-3 shrink-0" />
            Add a variant
          </MenuButton>
          <MenuItems
            anchor="bottom start"
            className="z-[110] w-56 rounded-xl border border-theme bg-background p-1 shadow-lg focus:outline-none"
          >
            {VARIANT_PRESETS.map( ( preset ) => (
              <MenuItem key={ preset.key }>
                <button
                  type="button"
                  onClick={ () => addVariant(
                    sketchKey,
                    preset
                  ) }
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-foreground data-focus:bg-hover"
                >
                  <span className="truncate">{preset.label}</span>
                  {preset.size && (
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-label">
                      {preset.size.width}×{preset.size.height}
                    </span>
                  )}
                </button>
              </MenuItem>
            ) )}
          </MenuItems>
        </Menu>
      </div>

      {/* The batch's own progress, along the footer's top edge: a row says how
          far ITS variant has got, and on a three-variant run that is not the
          question being asked. Two pixels, no label — the footer already names
          which variant is in hand. */}
      <div className={ running ? "h-0.5 w-full bg-foreground/15" : "h-0.5 w-full" }>
        <div
          aria-hidden="true"
          className="h-full bg-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={ {
            width: `${ running ? batchPercentage : 0 }%`
          } }
        />
      </div>

      <div className="flex items-center gap-2 border-t border-theme px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[10px] text-label">
          {error && <span className="text-red-500">{error}</span>}
          {!error && notice && <span className="text-red-500">{notice}</span>}
          {!error && !notice && running && (
            <span className="tabular-nums text-foreground/80">
              Variant {runningIndex + 1} of {snapshot.variants.length}
            </span>
          )}
          {!error && !notice && !running && unsavedFileCount > 0 && (
            <span className="text-foreground/80">
              {unsavedFileCount} file{unsavedFileCount === 1 ? "" : "s"} ready · not saved yet
            </span>
          )}
          {!error && !notice && !running && unsavedFileCount === 0 && (
            `${ snapshot.variants.length } variant${ snapshot.variants.length === 1 ? "" : "s" } · ${ fileCount } file${ fileCount === 1 ? "" : "s" }`
          )}
        </span>

        {running ? (
          <button
            type="button"
            onClick={ () => abortRef.current?.abort() }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/40 bg-background px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/5"
          >
            <span
              aria-hidden="true"
              className="block h-2 w-2 rounded-full bg-red-500 animate-pulse-soft"
            />
            Stop
          </button>
        ) : (
          <>
            {/* Re-exporting stays reachable while files are held, but it is no
                longer the loud button: saving what the last run produced is. */}
            <button
              type="button"
              onClick={ handleExport }
              disabled={ !engine || snapshot.variants.length === 0 || saving }
              // Every footer button carries a border, transparent on the
              // filled ones: without it the ink-filled Export is 2px shorter
              // than the outlined Stop it swaps with, and the dialog — which is
              // centred — jumps by a pixel each time a run starts or ends.
              className={ unsavedFileCount > 0
                ? "shrink-0 rounded-lg border border-theme bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40"
                : "shrink-0 rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40" }
            >
              Export {snapshot.variants.length === 1
                ? "variant"
                : `all ${ snapshot.variants.length }`}
            </button>

            {unsavedFileCount > 0 && (
              <button
                type="button"
                onClick={ handleSaveAll }
                disabled={ saving }
                className="shrink-0 rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {saving ? "Saving…" : `Save ${ unsavedFileCount } file${ unsavedFileCount === 1 ? "" : "s" }`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
