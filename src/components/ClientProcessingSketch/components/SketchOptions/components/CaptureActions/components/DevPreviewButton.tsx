"use client";

import React, {
  useState
} from "react";
import {
  Loader2
} from "lucide-react";
import ProgressFillButton from "../../ExportPanel/components/ProgressFillButton";
import type {
  RecorderCapabilities, RecorderProgress, RecordingMode
} from "@/engines/recording";
import type {
  PreviewPhase
} from "../hooks/useBrowserRecorder";

type DevPreviewButtonProps = {
  capabilities: RecorderCapabilities;
  progress: RecorderProgress | null;
  error: Error | null;
  previewPhase: PreviewPhase | null;
  countdown: number;
  previewSaved: boolean;
  onStart: ( mode: RecordingMode ) => void;
  onStop: () => void;
  onCancel: () => void;
};

/**
 * Dev-only: capture a clip and save it back over the sketch's committed
 * preview, instead of downloading it.
 *
 * This is not an export and deliberately does not live in the export panel —
 * it POSTs to `/api/dev/previews/save-from-blob`, it only exists in
 * development, and its output is a source-tree artefact rather than a file for
 * the user. Two flavours:
 *
 *   • Async    — a deterministic frame-by-frame pass of the sketch's loop, the
 *     front-end stand-in for the headless generator.
 *   • Realtime — after a 3-2-1 lead-in, a wall-clock capture, so interactive
 *     sketches (webcam / mic / hand tracking) can get a preview the headless
 *     generator cannot produce.
 */
export default function DevPreviewButton( {
  capabilities,
  progress,
  error,
  previewPhase,
  countdown,
  previewSaved,
  onStart,
  onStop,
  onCancel
}: DevPreviewButtonProps ) {
  const [
    mode,
    setMode
  ] = useState<RecordingMode>( capabilities.supportsDeterministicCapture
    ? "async-loop"
    : "realtime" );

  if ( previewPhase === "countdown" ) {
    return (
      <button
        type="button"
        onClick={ onCancel }
        aria-label="Cancel preview recording"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-theme bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-hover"
      >
        <span className="text-base font-semibold tabular-nums">{countdown}</span>
        <span className="truncate">Cancel</span>
      </button>
    );
  }

  if ( previewPhase === "saving" ) {
    return (
      <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-theme bg-background px-3 py-2 text-xs font-medium text-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="truncate">Encoding…</span>
      </div>
    );
  }

  if ( previewPhase === "recording" ) {
    // A realtime preview has no known length — the author stops it once the
    // interaction has played out. An async pass steps a known frame count, so
    // it gets a fill bar and a cancel instead.
    if ( mode === "realtime" ) {
      return (
        <button
          type="button"
          onClick={ onStop }
          aria-label="Stop preview recording"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-background px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/5"
        >
          <span
            aria-hidden="true"
            className="block h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse-soft"
          />
          <span className="truncate">Stop preview</span>
        </button>
      );
    }

    return (
      <ProgressFillButton
        onClick={ onCancel }
        ariaLabel="Cancel preview recording"
        percentage={ progress
          ? progress.stage === "capturing" ? progress.percentage : 100
          : 0 }
        label={ !progress
          ? "Recording preview…"
          : progress.stage === "encoding"
            ? "Encoding…"
            : progress.stage === "finalizing"
              ? "Finalising…"
              : `${ progress.percentage.toFixed( 0 ) }% (${ progress.frame }/${ progress.totalFrames })` }
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-1">
        <select
          value={ mode }
          onChange={ ( event ) => setMode( event.target.value as RecordingMode ) }
          aria-label="Preview recording mode"
          className="min-w-0 flex-1 rounded-lg border border-theme bg-background px-2 py-1.5 text-[11px] text-foreground focus:outline-none"
        >
          {capabilities.supportsDeterministicCapture && (
            <option value="async-loop">DEV preview: async</option>
          )}
          <option value="realtime">DEV preview: realtime</option>
        </select>

        <button
          type="button"
          onClick={ () => onStart( mode ) }
          aria-label="Record preview"
          title="Record preview"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-theme px-2 text-foreground transition-colors hover:bg-hover"
        >
          <span
            aria-hidden="true"
            className="block h-3 w-3 rounded-full bg-red-500 ring-1 ring-red-500/40"
          />
        </button>
      </div>

      {previewSaved && (
        <div className="text-[10px] text-green-500">
          Preview saved — review the files before committing.
        </div>
      )}

      {error && <div className="text-[10px] text-red-500">{error.message}</div>}
    </div>
  );
}
