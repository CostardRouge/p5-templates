"use client";

import React from "react";
import clsx from "clsx";
import {
  Copy, Trash2
} from "lucide-react";
import {
  formatBytes
} from "@/lib/export/download";
import {
  framerateOptionsFor,
  type ExportSize,
  type ExportVariant
} from "@/lib/export/variants";
import type {
  ExportItemState
} from "@/lib/export/runExportBatch";
import type {
  RecordingFormat
} from "@/engines/recording";
import ExportSizeSelect from "./ExportSizeSelect";

/**
 * What file the variant produces, as one choice.
 *
 * "Kind" used to be its own control, which asked the user to say twice what
 * they wanted: a kind, and then a format inside it. What they actually pick is
 * the file they get — so video containers, a single still and a still sequence
 * share one list, and `kind` is derived from it.
 */
type OutputChoice = {
  value: string;
  label: string;
  kind: ExportVariant[ "kind" ];
  format?: RecordingFormat;
  frameCount?: ExportVariant[ "frameCount" ];
};

function outputChoices( supportedFormats: RecordingFormat[] ): OutputChoice[] {
  return [
    ...supportedFormats.map( ( format ) => ( {
      value: `video:${ format }`,
      label: format,
      kind: "video" as const,
      format
    } ) ),
    {
      value: "image",
      label: "png (still)",
      kind: "image" as const
    },
    {
      value: "frames:10",
      label: "png × 10",
      kind: "frames" as const,
      frameCount: 10
    },
    {
      value: "frames:20",
      label: "png × 20",
      kind: "frames" as const,
      frameCount: 20
    },
    {
      value: "frames:all",
      label: "png × all",
      kind: "frames" as const,
      frameCount: "all" as const
    }
  ];
}

function currentChoiceValue( variant: ExportVariant ): string {
  if ( variant.kind === "image" ) {
    return "image";
  }

  if ( variant.kind === "frames" ) {
    return `frames:${ variant.frameCount }`;
  }

  return `video:${ variant.format }`;
}

const CELL = "px-2.5 py-1.5 align-middle";

/**
 * Sentinel for "whatever the sketch is set to", mirroring `ExportSizeSelect`'s
 * own native entry. A `<select>` cannot carry `null` as an option value, so
 * without it there is no way back to following the sketch once a rate is
 * picked — the variant stays pinned for the life of the stored list.
 */
const NATIVE_FRAMERATE = "native";

/** A muted em dash: this column does not apply to this variant. */
function NotApplicable() {
  return <span className="text-label/60">—</span>;
}

type VariantTableRowProps = {
  variant: ExportVariant;
  nativeSize: ExportSize;
  nativeFramerate: number;
  slideCount: number;
  slideSpan: number;
  /** The slides this variant covers disagree on canvas size. */
  mixedSizes: boolean;
  supportedFormats: RecordingFormat[];
  state?: ExportItemState;
  running: boolean;
  removable: boolean;
  onPatch: ( patch: Partial<ExportVariant> ) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

/**
 * One variant, as one row.
 *
 * Every setting is visible and editable in place, so the whole batch is
 * readable at once — the thing a list-plus-editor split could never do, since
 * it showed one variant's settings and summarised the rest.
 *
 * A column that does not apply says so with a dash rather than offering a
 * control that would be ignored: no framerate for a still, no slide scope
 * without slides, no delivery choice for a single file.
 */
export default function VariantTableRow( {
  variant,
  nativeSize,
  nativeFramerate,
  slideCount,
  slideSpan,
  mixedSizes,
  supportedFormats,
  state,
  running,
  removable,
  onPatch,
  onDuplicate,
  onRemove
}: VariantTableRowProps ) {
  const choices = outputChoices( supportedFormats );
  const framerates = framerateOptionsFor( nativeFramerate );
  const effectiveFramerate = Math.min(
    variant.framerate ?? nativeFramerate,
    nativeFramerate
  );
  // A pinned rate and a followed one can resolve to the same number, so the
  // cell reads the variant rather than the resolved value — otherwise there is
  // no way to see, or to get back to, "whatever the sketch is set to".
  const followsFramerate = variant.framerate === null;
  const isMultiSlide = slideSpan > 1;
  const status = state?.status;

  const selectClass =
    "w-full cursor-pointer appearance-none rounded-md border border-transparent bg-transparent px-1 py-1 text-[11px] text-foreground transition-colors hover:border-theme focus:border-theme focus:outline-none disabled:opacity-50";

  return (
    <tr className="relative border-b border-theme last:border-b-0">
      {/* Name, with the run's fill drawn along the row's bottom edge. */}
      <td className={ clsx(
        CELL,
        "relative"
      ) }
      >
        <input
          value={ variant.name }
          disabled={ running }
          aria-label="Variant name"
          onChange={ ( event ) => onPatch( {
            name: event.target.value
          } ) }
          className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[11.5px] font-medium text-foreground transition-colors hover:border-theme focus:border-theme focus:outline-none disabled:opacity-60"
        />
        {status === "running" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-red-500/70 transition-[width] duration-500"
            style={ {
              width: `${ state?.percentage ?? 0 }%`
            } }
          />
        )}
      </td>

      <td className={ CELL }>
        <ExportSizeSelect
          value={ variant.size }
          disabled={ running }
          nativeSize={ nativeSize }
          mixedSizes={ mixedSizes }
          sizeStrategy={ variant.sizeStrategy }
          onStrategyChange={ ( sizeStrategy ) => onPatch( {
            sizeStrategy
          } ) }
          onChange={ ( size ) => onPatch( {
            size
          } ) }
        />
      </td>

      <td className={ CELL }>
        <select
          value={ currentChoiceValue( variant ) }
          disabled={ running }
          aria-label="Output file"
          onChange={ ( event ) => {
            const choice = choices.find( ( entry ) => entry.value === event.target.value );

            if ( !choice ) {
              return;
            }

            onPatch( {
              kind: choice.kind,
              ...( choice.format ? {
                format: choice.format
              } : {} ),
              ...( choice.frameCount !== undefined ? {
                frameCount: choice.frameCount
              } : {} )
            } );
          } }
          className={ clsx(
            selectClass,
            "font-mono"
          ) }
        >
          {choices.map( ( choice ) => (
            <option key={ choice.value } value={ choice.value }>
              {choice.label}
            </option>
          ) )}
        </select>
      </td>

      <td className={ clsx(
        CELL,
        "font-mono text-[11px] tabular-nums"
      ) }
      >
        {variant.kind === "video" ? (
          <select
            value={ followsFramerate ? NATIVE_FRAMERATE : String( effectiveFramerate ) }
            disabled={ running }
            aria-label="Frame rate"
            onChange={ ( event ) => onPatch( {
              framerate: event.target.value === NATIVE_FRAMERATE
                ? null
                : Number( event.target.value )
            } ) }
            className={ selectClass }
            title={ `The sketch renders at ${ nativeFramerate } fps` }
          >
            <option value={ NATIVE_FRAMERATE }>{nativeFramerate} (sketch)</option>
            {framerates
              .filter( ( rate ) => rate !== nativeFramerate )
              .map( ( rate ) => (
                <option key={ rate } value={ rate }>{rate}</option>
              ) )}
          </select>
        ) : (
          <NotApplicable />
        )}
      </td>

      <td className={ CELL }>
        {slideCount > 0 ? (
          <select
            value={ Array.isArray( variant.slides ) ? "all" : variant.slides }
            disabled={ running }
            aria-label="Slides"
            onChange={ ( event ) => onPatch( {
              slides: event.target.value as ExportVariant[ "slides" ]
            } ) }
            className={ selectClass }
          >
            <option value="current">Current</option>
            <option value="all">All {slideCount}</option>
          </select>
        ) : (
          <NotApplicable />
        )}
      </td>

      {/* Output: what comes back, and — once running — how far along it is. */}
      <td className={ clsx(
        CELL,
        "text-right text-[11px]"
      ) }
      >
        {status === "running" && (
          <span className="text-foreground/80">
            {state?.stage}
            {state?.slideCount && state.slideCount > 1 && state.slide
              ? ` · slide ${ state.slide }/${ state.slideCount }`
              : ""}
          </span>
        )}

        {status === "done" && (
          <span className="text-green-500">
            ✓ {state?.bytes === undefined ? "Done" : formatBytes( state.bytes )}
          </span>
        )}

        {status === "failed" && (
          <span className="text-red-500" title={ state?.error }>✗ Failed</span>
        )}

        {( !status || status === "queued" || status === "cancelled" ) && (
          isMultiSlide && variant.kind === "video" ? (
            <select
              value={ variant.delivery }
              disabled={ running }
              aria-label="Delivery"
              onChange={ ( event ) => onPatch( {
                delivery: event.target.value as ExportVariant[ "delivery" ]
              } ) }
              className={ clsx(
                selectClass,
                "text-right"
              ) }
            >
              <option value="separate">.zip</option>
              <option value="combined">one {variant.format}</option>
            </select>
          ) : (
            <span className="font-mono text-label">
              {isMultiSlide || variant.kind === "frames" ? ".zip" : "1 file"}
            </span>
          )
        )}
      </td>

      <td className={ clsx(
        CELL,
        "w-0 whitespace-nowrap pr-2 text-right"
      ) }
      >
        <div className="inline-flex items-center gap-0.5">
          <button
            type="button"
            disabled={ running }
            aria-label={ `Duplicate ${ variant.name }` }
            onClick={ onDuplicate }
            className="rounded-md p-1 text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-30"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={ running || !removable }
            aria-label={ `Remove ${ variant.name }` }
            onClick={ onRemove }
            className="rounded-md p-1 text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-30"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}
