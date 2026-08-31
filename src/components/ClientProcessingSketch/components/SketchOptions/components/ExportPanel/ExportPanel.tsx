"use client";

import React, {
  useCallback, useMemo, useRef, useState, useSyncExternalStore
} from "react";
import {
  Plus
} from "lucide-react";
import {
  Menu, MenuButton, MenuItem, MenuItems
} from "@headlessui/react";
import {
  runExportBatch, type ExportItemState
} from "@/lib/export/runExportBatch";
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
  VARIANT_PRESETS,
  type ExportVariant
} from "@/lib/export/variants";
import useSketch from "../../../SketchProvider/hooks/useSketch";
import VariantTableRow from "./components/VariantTableRow";
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
};

const FALLBACK_FORMATS: RecordingFormat[] = [
  "mp4",
  "webm",
  "gif"
];

const HEAD_CELL =
  "px-2.5 py-2 text-left text-[9.5px] font-semibold uppercase tracking-[0.09em] text-label";

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
 * The row doubles as the run queue: its name cell carries the progress fill
 * and its output cell the live stage, so "62% · slide 2/7" is attached to the
 * variant it belongs to rather than to a single global bar.
 */
export default function ExportPanel( {
  name,
  options,
  activeSlideIndex
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
  const abortRef = useRef<AbortController | null>( null );

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

  const handleExport = async() => {
    if ( running || !engine || snapshot.variants.length === 0 ) {
      return;
    }

    const controller = new AbortController();

    abortRef.current = controller;
    setRunning( true );
    setError( null );

    try {
      await runExportBatch( {
        engine,
        options,
        sketchName: name,
        activeSlideIndex,
        variants: snapshot.variants,
        signal: controller.signal,
        onProgress: setItems
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

  const stateFor = ( id: string ) => items.find( ( item ) => item.variantId === id );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The table keeps a floor width and the container scrolls: crushing
          six editable columns into a phone would be worse than a sideways
          scroll inside the dialog. */}
      {/* Opaque, unlike the dialog's glass chrome around it: a table of small
          mono values with a sketch showing through is unreadable, and this is
          the region you actually read. The glass stays on the title bar and
          the footer, where it still frames the dialog against the canvas. */}
      <div className="min-h-0 flex-1 overflow-auto bg-background">
        <table className="w-full min-w-[600px] border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b border-theme">
              <th scope="col" className={ HEAD_CELL }>Variant</th>
              <th scope="col" className={ HEAD_CELL }>Size</th>
              <th scope="col" className={ HEAD_CELL }>Output</th>
              <th scope="col" className={ HEAD_CELL }>Rate</th>
              <th scope="col" className={ HEAD_CELL }>Slides</th>
              <th scope="col" className={ `${ HEAD_CELL } text-right` }>Delivers</th>
              <th scope="col" className="w-0 px-2">
                <span className="sr-only">Row actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {snapshot.variants.map( ( variant ) => (
              <VariantTableRow
                key={ variant.id }
                variant={ variant }
                nativeSize={ nativeSizeFor(
                  options,
                  activeSlideIndex
                ) }
                nativeFramerate={ nativeFramerateFor(
                  options,
                  activeSlideIndex
                ) }
                slideCount={ slideCount }
                slideSpan={ slidesOf( variant ).length }
                mixedSizes={ hasMixedSlideSizes(
                  variant,
                  options,
                  slidesOf( variant )
                ) }
                supportedFormats={ supportedFormats }
                state={ stateFor( variant.id ) }
                running={ running }
                removable={ snapshot.variants.length > 1 }
                onPatch={ ( patch ) => patchVariant(
                  sketchKey,
                  variant.id,
                  patch
                ) }
                onDuplicate={ () => duplicateVariantById(
                  sketchKey,
                  variant.id
                ) }
                onRemove={ () => removeVariant(
                  sketchKey,
                  variant.id
                ) }
              />
            ) )}
          </tbody>
        </table>

        {/* Adding a variant starts from a preset, never a blank row: a new
            variant needing four fields filled in before it does anything is
            not a starting point. */}
        <Menu as="div" className="relative">
          <MenuButton
            disabled={ running }
            className="flex w-full items-center gap-1.5 border-t border-dashed border-theme px-2.5 py-2 text-left text-[11px] text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-40"
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

      <div className="flex items-center gap-2 border-t border-theme px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[10px] text-label">
          {error ? (
            <span className="text-red-500">{error}</span>
          ) : (
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
          <button
            type="button"
            onClick={ handleExport }
            disabled={ !engine || snapshot.variants.length === 0 }
            className="shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            Export {snapshot.variants.length === 1
              ? "variant"
              : `all ${ snapshot.variants.length }`}
          </button>
        )}
      </div>
    </div>
  );
}
