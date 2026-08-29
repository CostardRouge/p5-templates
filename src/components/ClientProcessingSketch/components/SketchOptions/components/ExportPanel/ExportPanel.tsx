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
  selectVariant,
  subscribeVariants
} from "@/lib/export/variantStore";
import {
  nativeFramerateFor,
  resolveRunSize,
  resolveSlideIndices,
  VARIANT_PRESETS,
  type ExportSize,
  type ExportVariant
} from "@/lib/export/variants";
import useSketch from "../../../SketchProvider/hooks/useSketch";
import VariantEditor from "./components/VariantEditor";
import VariantRow from "./components/VariantRow";
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

/** The canvas sizes offered per variant, deduped and ordered by area. */
const SIZE_PRESETS: ExportSize[] = [
  {
    width: 1080,
    height: 1080
  },
  {
    width: 1080,
    height: 1350
  },
  {
    width: 1080,
    height: 1920
  },
  {
    width: 1200,
    height: 630
  },
  {
    width: 1920,
    height: 1080
  },
  {
    width: 2160,
    height: 2700
  },
  {
    width: 3840,
    height: 2160
  }
];

/**
 * The export surface: a list of variants on the left, the selected variant's
 * settings on the right, one run button along the bottom.
 *
 * The list doubles as the run queue. With several variants in flight a single
 * global progress bar cannot say which one is where, so each row carries its
 * own state and, for multi-slide variants, its own slide counter.
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

  // Seed before the first subscription read so the list is never momentarily
  // empty on open.
  ensureVariants(
    sketchKey,
    options,
    activeSlideIndex
  );

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

  const selected = snapshot.variants.find( ( variant ) => variant.id === snapshot.selectedId )
    ?? snapshot.variants[ 0 ]
    ?? null;

  /** Everything a row or the editor needs to describe a variant truthfully. */
  const describe = useCallback(
    ( variant: ExportVariant ) => {
      const slideIndices = resolveSlideIndices(
        variant,
        slideCount,
        activeSlideIndex
      );
      const nativeFramerate = nativeFramerateFor(
        options,
        slideIndices[ 0 ]
      );

      return {
        slideIndices,
        nativeFramerate,
        framerate: Math.min(
          variant.framerate ?? nativeFramerate,
          nativeFramerate
        ),
        size: resolveRunSize(
          variant,
          options,
          slideIndices
        ) ?? {
          width: 1080,
          height: 1350
        }
      };
    },
    [
      options,
      slideCount,
      activeSlideIndex
    ]
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

  const list = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-theme px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
          Variants
        </span>

        <Menu as="div" className="relative ml-auto">
          <MenuButton
            aria-label="Add a variant"
            disabled={ running }
            className="rounded-md p-1 text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </MenuButton>
          <MenuItems
            anchor="bottom end"
            className="z-[110] w-52 rounded-xl border border-theme bg-background p-1 shadow-lg focus:outline-none"
          >
            {VARIANT_PRESETS.map( ( preset ) => (
              <MenuItem key={ preset.key }>
                <button
                  type="button"
                  onClick={ () => addVariant(
                    sketchKey,
                    preset,
                    options,
                    activeSlideIndex
                  ) }
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-foreground data-focus:bg-hover"
                >
                  <span className="truncate">{preset.label}</span>
                  {preset.size && (
                    <span className="shrink-0 font-mono text-[10px] text-label">
                      {preset.size.width}×{preset.size.height}
                    </span>
                  )}
                </button>
              </MenuItem>
            ) )}
            {selected && (
              <MenuItem>
                <button
                  type="button"
                  onClick={ () => duplicateVariantById(
                    sketchKey,
                    selected.id
                  ) }
                  className="mt-1 w-full truncate rounded-lg border-t border-theme px-2 py-1.5 text-left text-xs text-foreground data-focus:bg-hover"
                >
                  Duplicate selected
                </button>
              </MenuItem>
            )}
          </MenuItems>
        </Menu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {snapshot.variants.map( ( variant ) => {
          const described = describe( variant );

          return (
            <VariantRow
              key={ variant.id }
              variant={ variant }
              size={ described.size }
              framerate={ described.framerate }
              slideCount={ described.slideIndices.length }
              selected={ variant.id === selected?.id }
              state={ stateFor( variant.id ) }
              removable={ snapshot.variants.length > 1 && !running }
              onSelect={ () => selectVariant(
                sketchKey,
                variant.id
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
          );
        } )}
      </div>

      <div className="border-t border-theme px-3 py-2 text-[10px] text-label">
        {snapshot.variants.length} variant
        {snapshot.variants.length === 1 ? "" : "s"}
        {slideCount > 0 && ` · ${ slideCount } slide${ slideCount === 1 ? "" : "s" } available` }
      </div>
    </div>
  );

  const editor = selected
    ? (
      <VariantEditor
        variant={ selected }
        options={ options }
        sketchName={ name }
        slideIndices={ describe( selected ).slideIndices }
        slideCount={ slideCount }
        runSize={ describe( selected ).size }
        nativeFramerate={ describe( selected ).nativeFramerate }
        supportedFormats={ supportedFormats }
        sizePresets={ SIZE_PRESETS }
        disabled={ running }
        onPatch={ ( patch ) => patchVariant(
          sketchKey,
          selected.id,
          patch
        ) }
      />
    )
    : (
      <div className="flex flex-1 items-center justify-center p-4 text-xs text-label">
        Add a variant to get started.
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Two columns only where there is room for them. Below `md` the dialog
          is roughly a phone wide, so a split would leave each side too narrow
          to read: the list stacks above the editor instead, capped so the
          editor stays reachable without scrolling the whole dialog. */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:divide-x md:divide-theme">
        <div className="flex max-h-48 min-h-0 flex-col md:max-h-none md:w-1/2">
          {list}
        </div>
        <div className="flex min-h-0 flex-1 flex-col border-t border-theme md:flex-none md:w-1/2 md:border-t-0">
          {editor}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-theme px-3 py-2">
        {error && (
          <span className="min-w-0 flex-1 truncate text-[10px] text-red-500">
            {error}
          </span>
        )}

        {running
          ? (
            <button
              type="button"
              onClick={ () => abortRef.current?.abort() }
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-background px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/5"
            >
              <span
                aria-hidden="true"
                className="block h-2 w-2 rounded-full bg-red-500 animate-pulse-soft"
              />
              Stop
            </button>
          )
          : (
            <button
              type="button"
              onClick={ handleExport }
              disabled={ !engine || snapshot.variants.length === 0 }
              className="ml-auto inline-flex items-center rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
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
