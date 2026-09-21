"use client";

import React from "react";
import clsx from "clsx";
import {
  Copy, Trash2
} from "lucide-react";
import type {
  ExportSize, ExportVariant
} from "@/lib/export/variants";
import type {
  ExportItemState
} from "@/lib/export/runExportBatch";
import type {
  RecordingFormat
} from "@/engines/recording";
import PhaseMeter, {
  ProgressWipe, statusLabel
} from "./ExportProgress";
import {
  VariantDelivery,
  VariantName,
  VariantOutput,
  VariantRate,
  VariantSize,
  VariantSlides
} from "./VariantFields";

/**
 * The table's column tracks, declared once.
 *
 * A grid, not a `<table>`, and that is the whole point: an auto table derives
 * its column widths from the widest cell on every render, so a status that
 * counted frames re-measured all six columns sixty times a second and the row
 * visibly crawled while it exported. Here the tracks are fixed numbers and
 * nothing a cell says can move them. Table SEMANTICS are kept through ARIA
 * roles, which is what they were ever for.
 *
 * `minmax(0, 1fr)` on the name column, never `1fr`: a bare `1fr` has an `auto`
 * minimum, so a long variant name would push the fixed tracks off the end —
 * which is the same defect wearing a different hat.
 */
export const VARIANT_GRID =
  "grid grid-cols-[minmax(0,1fr)_148px_96px_52px_80px_148px_48px]";

const CELL = "min-w-0 px-2.5";

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
  /** This variant's files actually reached the user. A finished variant that
   *  has not is the whole point of the deferred delivery path. */
  delivered: boolean;
  removable: boolean;
  /** Present once this variant's files are in hand and can be previewed. */
  onPreview?: () => void;
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
 *
 * The row doubles as the run's progress bar. Three things carry it and none of
 * them changes the row's size: the inversion sweeping across the whole row
 * (`ProgressWipe`), the phase meter under the status, and the slide counter
 * that takes the Slides cell's place while a multi-slide variant runs. The
 * meter's 3px strip is reserved on every row, running or not, so a run cannot
 * make the table grow.
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
  delivered,
  removable,
  onPreview,
  onPatch,
  onDuplicate,
  onRemove
}: VariantTableRowProps ) {
  const fields = {
    variant,
    running,
    onPatch
  };
  const isRunning = state?.status === "running";
  const showSlideCounter =
    isRunning && state.slide !== undefined && ( state.slideCount ?? 0 ) > 1;

  return (
    <div
      role="row"
      className={ clsx(
        VARIANT_GRID,
        // `isolate` keeps the wipe's blend inside this row, and the opaque
        // background is what it inverts against.
        //
        // Taller on a phone, which gets this same table: 52px puts every cell's
        // control within a thumb's reach. Fixed either way — a row whose height
        // depends on what it is saying is a row that jumps mid-run.
        "relative isolate h-[52px] items-center border-b border-theme bg-background last:border-b-0 md:h-[38px]"
      ) }
    >
      <div role="cell" className={ CELL }>
        <VariantName { ...fields } />
      </div>

      <div role="cell" className={ CELL }>
        <VariantSize
          { ...fields }
          nativeSize={ nativeSize }
          mixedSizes={ mixedSizes }
        />
      </div>

      <div role="cell" className={ CELL }>
        <VariantOutput { ...fields } supportedFormats={ supportedFormats } />
      </div>

      <div
        role="cell"
        className={ clsx(
          CELL,
          "font-mono text-[11px] tabular-nums"
        ) }
      >
        <VariantRate { ...fields } nativeFramerate={ nativeFramerate } />
      </div>

      {/* Which slide a run is on belongs in the Slides cell, not appended to
          the status: a ` · slide 2/7` tacked onto a label is one more string
          that changes width while the run reports. */}
      <div role="cell" className={ CELL }>
        {showSlideCounter ? (
          <span className="font-mono text-[11px] tabular-nums text-foreground/80">
            {state.slide}/{state.slideCount}
          </span>
        ) : (
          <VariantSlides { ...fields } slideCount={ slideCount } />
        )}
      </div>

      {/* Output: what comes back, and — once running — how far along it is. */}
      <div
        role="cell"
        className={ clsx(
          CELL,
          "flex flex-col items-end justify-center gap-1 text-[11px]"
        ) }
      >
        {state && state.status !== "queued" ? (
          onPreview && state.status === "done" ? (
            <button
              type="button"
              onClick={ onPreview }
              title={ delivered
                ? "See what this produced"
                : "Ready, not saved yet — open it to save" }
              className={ clsx(
                "rounded-md px-1 py-0.5 font-mono tabular-nums underline decoration-dotted underline-offset-2 transition-colors hover:bg-hover",
                delivered ? "text-green-500" : "text-foreground/80"
              ) }
            >
              {statusLabel(
                state,
                delivered
              )}
            </button>
          ) : (
            <span
              title={ state.error }
              className={ clsx(
                "px-1 font-mono tabular-nums",
                state.status === "failed" && "text-red-500",
                state.status === "done" && delivered && "text-green-500"
              ) }
            >
              {statusLabel(
                state,
                delivered
              )}
            </span>
          )
        ) : (
          <VariantDelivery { ...fields } slideSpan={ slideSpan } align="right" />
        )}

        {/* Reserved on every row, drawn only once the batch has said something
            about this variant: the height is constant either way. */}
        <div className="h-[3px] w-full">
          {state && <PhaseMeter kind={ variant.kind } state={ state } />}
        </div>
      </div>

      <div
        role="cell"
        className="flex items-center justify-end gap-0.5 pr-2"
      >
        <button
          type="button"
          disabled={ running }
          aria-label={ `Duplicate ${ variant.name }` }
          onClick={ onDuplicate }
          className="rounded-md p-2 text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-30 md:p-1"
        >
          <Copy className="h-3.5 w-3.5 md:h-3 md:w-3" />
        </button>
        <button
          type="button"
          disabled={ running || !removable }
          aria-label={ `Remove ${ variant.name }` }
          onClick={ onRemove }
          className="rounded-md p-2 text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-30 md:p-1"
        >
          <Trash2 className="h-3.5 w-3.5 md:h-3 md:w-3" />
        </button>
      </div>

      {isRunning && <ProgressWipe percentage={ state.percentage } />}
    </div>
  );
}
