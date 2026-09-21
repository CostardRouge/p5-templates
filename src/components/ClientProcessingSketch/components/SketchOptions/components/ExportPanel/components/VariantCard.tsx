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

const FIELD_LABEL =
  "text-[9px] font-semibold uppercase tracking-[0.09em] text-label";

/** One labelled setting, sized for a thumb. */
function Field( {
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
} ) {
  return (
    <div className="flex min-h-[44px] min-w-0 flex-col justify-center gap-0.5 rounded-lg border border-theme px-2 py-1">
      <span className={ FIELD_LABEL }>{label}</span>
      <div className="min-w-0 text-[12px]">{children}</div>
    </div>
  );
}

type VariantCardProps = {
  variant: ExportVariant;
  nativeSize: ExportSize;
  nativeFramerate: number;
  slideCount: number;
  slideSpan: number;
  mixedSizes: boolean;
  supportedFormats: RecordingFormat[];
  state?: ExportItemState;
  running: boolean;
  delivered: boolean;
  removable: boolean;
  onPreview?: () => void;
  onPatch: ( patch: Partial<ExportVariant> ) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

/**
 * One variant, as one card — the same row, folded for a phone.
 *
 * The table's six columns held a `min-w-[600px]` floor and scrolled sideways,
 * which on a 390px screen meant Size, Rate and Delivers sat off-screen: the
 * settings were not hidden behind a disclosure, they were simply somewhere you
 * had to discover by dragging. Folding the row into labelled fields puts every
 * one of them on screen at once, at a size a thumb can hit, and the controls
 * are literally the same components the row uses.
 *
 * Progress is the row's, unchanged: the inversion sweeps the whole card, the
 * phase meter sits along its bottom edge, and neither changes the card's size.
 */
export default function VariantCard( {
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
}: VariantCardProps ) {
  const fields = {
    variant,
    running,
    onPatch
  };
  const isRunning = state?.status === "running";

  return (
    <div className="relative isolate overflow-hidden rounded-xl border border-theme bg-background">
      <div className="flex flex-col gap-2 p-2.5">
        <div className="flex items-center gap-2">
          <VariantName { ...fields } className="text-[14px]" />

          {state && state.status !== "queued" ? (
            onPreview && state.status === "done" ? (
              <button
                type="button"
                onClick={ onPreview }
                className={ clsx(
                  "shrink-0 rounded-md px-1.5 py-1 font-mono text-[12px] tabular-nums underline decoration-dotted underline-offset-2",
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
                className={ clsx(
                  "shrink-0 px-1 font-mono text-[12px] tabular-nums",
                  state.status === "failed" ? "text-red-500" : "text-foreground/80"
                ) }
              >
                {statusLabel(
                  state,
                  delivered
                )}
              </span>
            )
          ) : (
            <span className="shrink-0 text-[11px] text-label">
              {state ? "Queued" : ""}
            </span>
          )}

          <button
            type="button"
            disabled={ running }
            aria-label={ `Duplicate ${ variant.name }` }
            onClick={ onDuplicate }
            className="shrink-0 rounded-md p-2 text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-30"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={ running || !removable }
            aria-label={ `Remove ${ variant.name }` }
            onClick={ onRemove }
            className="shrink-0 rounded-md p-2 text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Size">
            <VariantSize
              { ...fields }
              nativeSize={ nativeSize }
              mixedSizes={ mixedSizes }
            />
          </Field>
          <Field label="Output">
            <VariantOutput { ...fields } supportedFormats={ supportedFormats } />
          </Field>
          <Field label="Rate">
            <VariantRate { ...fields } nativeFramerate={ nativeFramerate } />
          </Field>
          {/* Same swap as the row: which slide a run is on takes the Slides
              cell rather than being appended to the status label. */}
          <Field label="Slides">
            {isRunning && state.slide !== undefined && ( state.slideCount ?? 0 ) > 1 ? (
              <span className="font-mono tabular-nums text-foreground/80">
                {state.slide}/{state.slideCount}
              </span>
            ) : (
              <VariantSlides { ...fields } slideCount={ slideCount } />
            )}
          </Field>
        </div>

        <Field label="Delivers">
          <VariantDelivery { ...fields } slideSpan={ slideSpan } />
        </Field>

        {/* Reserved whether or not anything runs, same rule as the row. */}
        <div className="h-[3px] w-full">
          {state && <PhaseMeter kind={ variant.kind } state={ state } />}
        </div>
      </div>

      {isRunning && <ProgressWipe percentage={ state.percentage } />}
    </div>
  );
}
