"use client";

import React, {
  useMemo, useState
} from "react";
import {
  Download, Loader2, StopCircle
} from "lucide-react";
import type {
  RecorderCapabilities, RecorderProgress, RecordingFormat, RecordingMode
} from "@/engines/recording";
import {
  useSmoothFill
} from "@/hooks/useSmoothFill";
import type {
  PreviewPhase, RecordingIntent
} from "../hooks/useBrowserRecorder";
import type {
  FrameCount, FrameExportProgress
} from "../hooks/useFrameExporter";

type BrowserRecordingButtonProps = {
  capabilities: RecorderCapabilities;
  isRecording: boolean;
  progress: RecorderProgress | null;
  error: Error | null;
  previewPhase: PreviewPhase | null;
  countdown: number;
  previewSaved: boolean;
  onStart: (
    format: RecordingFormat,
    mode: RecordingMode,
    intent: RecordingIntent
  ) => void;
  onStop: () => void;
  onCancel: () => void;
  // Still-frame sequence export ("Frames" group). Shares the sketch engine
  // with recording, so the two can never run at once — the UI swaps between
  // them.
  frameExport: {
    isExporting: boolean;
    progress: FrameExportProgress | null;
    error: Error | null;
    onExport: ( count: FrameCount ) => void;
    onCancel: () => void;
  };
};

const FORMAT_LABEL: Record<RecordingFormat, string> = {
  webm: ".webm",
  gif: ".gif",
  mp4: ".mp4"
};

const MODE_LABEL: Record<RecordingMode, string> = {
  "async-loop": "Async loop",
  realtime: "Realtime"
};

// Per-mode format availability — gif is async-loop only; webm/mp4 work
// in both modes via MediaRecorder (realtime) or mediabunny (async-loop).
// First entry in each group is the default for that mode. mp4 leads
// because it plays in every consumer (X, Instagram, native browsers)
// without re-encoding, unlike webm.
const MODE_FORMATS: Record<RecordingMode, RecordingFormat[]> = {
  "async-loop": [
    "mp4",
    "webm",
    "gif"
  ],
  realtime: [
    "mp4",
    "webm"
  ]
};

const MODE_ORDER: ReadonlyArray<RecordingMode> = [
  "async-loop",
  "realtime"
];

// Still-frame export group. Each entry samples the loop evenly and bundles
// the PNGs into a single `.zip` (see `useFrameExporter`). Gated on the engine
// being able to render arbitrary frames reproducibly — a realtime-only sketch
// can't be sampled deterministically.
const FRAMES_GROUP_LABEL = "Frames (.zip)";

const FRAMES_OPTIONS: ReadonlyArray<{
  key: string;
  label: string;
  count: FrameCount;
}> = [
  {
    key: "frames-10",
    label: "10 × .png",
    count: 10
  },
  {
    key: "frames-20",
    label: "20 × .png",
    count: 20
  },
  {
    key: "frames-all",
    label: "All frames",
    count: "all"
  }
];

// Dev-only group: a webm capture that, instead of downloading, is saved
// back over the sketch's committed preview. Both flavours share one compact
// group so the dropdown stays narrow and never pushes the record button off
// screen.
//   • async    — a deterministic frame-by-frame capture of the sketch's loop.
//     No lead-in, no frame drops — the front-end stand-in for the headless
//     generator, for when it isn't available.
//   • realtime — after a 3-2-1 lead-in, a wall-clock capture. Lets
//     interactive sketches (webcam / mic / hand tracking) get a real preview
//     the headless generator can't produce.
const PREVIEW_GROUP_LABEL = "DEV: previews recording";
const PREVIEW_ASYNC_OPTION_LABEL = "Async";
const PREVIEW_REALTIME_OPTION_LABEL = "Realtime";
const IS_DEV = process.env.NODE_ENV === "development";

// One <option> per group entry. The composite value carries everything the
// record button needs; including the group label in the visible text keeps the
// active choice readable without re-opening the dropdown.
//
// A choice is either a video recording (`record`) or a still-frame sequence
// export (`frames`) — the record button branches on `kind`.
type RecordChoice = {
  kind: "record";
  format: RecordingFormat;
  mode: RecordingMode;
  intent: RecordingIntent;
};

type FramesChoice = {
  kind: "frames";
  count: FrameCount;
};

type Choice = RecordChoice | FramesChoice;

// One <option> in the dropdown. The label is what shows when collapsed, so
// keep it short; the choice carries everything `start()` needs.
type RecordingOption = {
  key: string;
  label: string;
  choice: Choice;
};

type RecordingGroup = {
  key: string;
  label: string;
  options: RecordingOption[];
};

function encodeChoice( c: Choice ): string {
  return c.kind === "frames"
    ? `frames|${ c.count }`
    : `record|${ c.format }|${ c.mode }|${ c.intent }`;
}

function decodeChoice( value: string ): Choice {
  const parts = value.split( "|" );

  if ( parts[ 0 ] === "frames" ) {
    const raw = parts[ 1 ];

    return {
      kind: "frames",
      count: raw === "all" ? "all" : Number( raw )
    };
  }

  const [
    ,
    format,
    mode,
    intent
  ] = parts as [ string, RecordingFormat, RecordingMode, RecordingIntent ];

  return {
    kind: "record",
    format,
    mode,
    intent: intent ?? "download"
  };
}

function formatChoiceLabel(
  groupLabel: string, format: RecordingFormat
): string {
  return `${ groupLabel }: ${ FORMAT_LABEL[ format ] }`;
}

export default function BrowserRecordingButton( {
  capabilities,
  isRecording,
  progress,
  error,
  previewPhase,
  countdown,
  previewSaved,
  onStart,
  onStop,
  onCancel,
  frameExport
}: BrowserRecordingButtonProps ) {
  const groups = useMemo<RecordingGroup[]>(
    () => {
      const supported = new Set( capabilities.supportedFormats );

      const modeGroups: RecordingGroup[] = MODE_ORDER
        .map( ( mode ) => ( {
          key: mode,
          label: MODE_LABEL[ mode ],
          options: MODE_FORMATS[ mode ]
            .filter( ( f ) => supported.has( f ) )
            .map( ( f ) => ( {
              key: `${ mode }-${ f }`,
              label: formatChoiceLabel(
                MODE_LABEL[ mode ],
                f
              ),
              choice: {
                kind: "record" as const,
                format: f,
                mode,
                intent: "download" as RecordingIntent
              }
            } ) )
        } ) )
        .filter( ( g ) => g.options.length > 0 );

      if ( IS_DEV && supported.has( "webm" ) ) {
        const previewOptions: RecordingOption[] = [];

        // The async flavour needs the engine to render arbitrary frames
        // reproducibly — otherwise the deterministic loop can't be captured.
        if ( capabilities.supportsDeterministicCapture ) {
          previewOptions.push( {
            key: "preview-async",
            label: PREVIEW_ASYNC_OPTION_LABEL,
            choice: {
              kind: "record",
              format: "webm",
              mode: "async-loop",
              intent: "preview"
            }
          } );
        }

        previewOptions.push( {
          key: "preview-realtime",
          label: PREVIEW_REALTIME_OPTION_LABEL,
          choice: {
            kind: "record",
            format: "webm",
            mode: "realtime",
            intent: "preview"
          }
        } );

        modeGroups.push( {
          key: "preview",
          label: PREVIEW_GROUP_LABEL,
          options: previewOptions
        } );
      }

      // Deterministic engines can be frame-stepped, so offer the still-frame
      // sequence export. Realtime-only sketches can't be sampled reproducibly,
      // so the group is simply absent for them.
      if ( capabilities.supportsDeterministicCapture ) {
        modeGroups.push( {
          key: "frames",
          label: FRAMES_GROUP_LABEL,
          options: FRAMES_OPTIONS.map( ( frameOption ) => ( {
            key: frameOption.key,
            label: frameOption.label,
            choice: {
              kind: "frames" as const,
              count: frameOption.count
            }
          } ) )
        } );
      }

      return modeGroups;
    },
    [
      capabilities.supportedFormats,
      capabilities.supportsDeterministicCapture
    ]
  );

  const defaultChoice: Choice = useMemo(
    () => {
      const preferredMode = capabilities.defaultMode;
      const options = groups.flatMap( ( g ) => g.options );
      // Never default to a frames export — it's an explicit, opt-in action.
      const match =
        options.find( ( o ) =>
          o.choice.kind === "record" &&
            o.choice.intent === "download" &&
            o.choice.mode === preferredMode ) ??
          options.find( ( o ) => o.choice.kind === "record" && o.choice.intent === "download" ) ??
          options[ 0 ];

      return match?.choice ?? {
        kind: "record",
        mode: "async-loop",
        format: "webm",
        intent: "download"
      };
    },
    [
      capabilities.defaultMode,
      groups
    ]
  );

  const [
    choice,
    setChoice
  ] = useState<Choice>( defaultChoice );

  // Recording controls only render off the back of a record choice, but the
  // union forces a guard — fall back to the deterministic mode for the (never
  // reached) frames case.
  const recordMode: RecordingMode =
    choice.kind === "record" ? choice.mode : "async-loop";

  // A frames export owns the button for its duration — progress + cancel,
  // no format dropdown.
  if ( frameExport.isExporting ) {
    return (
      <FramesExportControls
        progress={ frameExport.progress }
        onCancel={ frameExport.onCancel }
      />
    );
  }

  // A dev "Record preview" run drives its own countdown → recording →
  // saving controls, distinct from the regular realtime / async-loop UI.
  if ( previewPhase ) {
    return (
      <PreviewRecordingControls
        phase={ previewPhase }
        mode={ recordMode }
        progress={ progress }
        countdown={ countdown }
        onStop={ onStop }
        onCancel={ onCancel }
      />
    );
  }

  if ( isRecording ) {
    const isRealtime = recordMode === "realtime";

    if ( isRealtime ) {
      return (
        <RealtimeRecordingControls onStop={ onStop } />
      );
    }

    return (
      <AsyncLoopRecordingControls
        progress={ progress }
        onCancel={ onCancel }
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-stretch gap-1 rounded-xl border border-border overflow-hidden bg-background">
        <select
          id="recording-format"
          value={ encodeChoice( choice ) }
          onChange={ ( e ) => setChoice( decodeChoice( e.target.value ) ) }
          className="flex-1 min-w-0 px-2 py-2 bg-background text-foreground text-xs focus:outline-none"
          aria-label="Recording format"
        >
          {groups.map( ( group ) => (
            <optgroup key={ group.key } label={ group.label }>
              {group.options.map( ( option ) => (
                <option
                  key={ option.key }
                  value={ encodeChoice( option.choice ) }
                >
                  {option.label}
                </option>
              ) )}
            </optgroup>
          ) )}
        </select>

        <button
          type="button"
          onClick={ () => {
            if ( choice.kind === "frames" ) {
              frameExport.onExport( choice.count );
            } else {
              onStart(
                choice.format,
                choice.mode,
                choice.intent
              );
            }
          } }
          aria-label={
            choice.kind === "frames" ? "Export frames" : "Start recording"
          }
          title={
            choice.kind === "frames" ? "Export frames" : "Start recording"
          }
          className="flex-shrink-0 border-l px-2 text-foreground hover:bg-hover transition-colors inline-flex items-center justify-center"
        >
          {choice.kind === "frames" ? (
            <Download className="h-4 w-4" />
          ) : (
            <span
              aria-hidden="true"
              className="block h-3 w-3 rounded-full bg-red-500 ring-1 ring-red-500/40"
            />
          )}
        </button>
      </div>

      {previewSaved && (
        <div className="text-[10px] text-green-500">
          Preview saved — review the files before committing.
        </div>
      )}

      {( error || frameExport.error ) && (
        <div className="text-[10px] text-red-500">
          {( error ?? frameExport.error )?.message}
        </div>
      )}
    </div>
  );
}

/**
 * Realtime capture has no known duration — the user stops it when
 * they're happy. A fill bar would be misleading, so the button just
 * pulses a red dot while recording.
 */
function RealtimeRecordingControls( {
  onStop
}: { onStop: () => void } ) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-gray-400 text-center min-h-[1em]">
        Recording…
      </div>
      <button
        type="button"
        onClick={ onStop }
        aria-label="Stop recording"
        className="relative rounded-xl px-3 py-2.5 border border-red-500/40 text-red-600 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 bg-background hover:bg-red-500/5"
      >
        <span
          aria-hidden="true"
          className="block h-2.5 w-2.5 rounded-full bg-red-500 ring-1 ring-red-500/40 animate-pulse-soft"
        />
        <span className="truncate">Stop recording</span>
      </button>
    </div>
  );
}

/**
 * Dev "Record preview" lifecycle, for both flavours. The clip is always
 * re-encoded server-side into the committed preview variants once captured.
 *
 *   • realtime   – a lead-in countdown gives the author time to get an
 *     interaction (webcam / mic / hand tracking) ready; the capture then runs
 *     for a fixed length and auto-stops (the author may stop it early).
 *   • async-loop – no countdown; a deterministic frame-by-frame pass of the
 *     sketch's loop, surfaced as a progress bar with a cancel affordance.
 */
function PreviewRecordingControls( {
  phase,
  mode,
  progress,
  countdown,
  onStop,
  onCancel
}: {
  phase: PreviewPhase;
  mode: RecordingMode;
  progress: RecorderProgress | null;
  countdown: number;
  onStop: () => void;
  onCancel: () => void;
} ) {
  if ( phase === "countdown" ) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-400 text-center min-h-[1em]">
          Get ready…
        </div>
        <button
          type="button"
          onClick={ onCancel }
          aria-label="Cancel preview recording"
          className="rounded-xl px-3 py-2.5 border border-border text-foreground text-xs font-medium transition-colors inline-flex items-center justify-center gap-2 bg-background hover:bg-hover"
        >
          <span className="text-base font-semibold tabular-nums">
            {countdown}
          </span>
          <span className="truncate">Cancel</span>
        </button>
      </div>
    );
  }

  if ( phase === "saving" ) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-400 text-center min-h-[1em]">
          Saving preview…
        </div>
        <div className="rounded-xl px-3 py-2.5 border border-border text-foreground text-xs font-medium inline-flex items-center justify-center gap-1.5 bg-background">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="truncate">Encoding…</span>
        </div>
      </div>
    );
  }

  // Async-loop previews step through a known frame count — surface it as a
  // progress bar + cancel (a mid-loop stop would commit a partial preview).
  if ( mode === "async-loop" ) {
    return (
      <PreviewAsyncRecordingControls
        progress={ progress }
        onCancel={ onCancel }
      />
    );
  }

  // Realtime previews have no known length: the author stops the capture
  // once the interaction they're demoing has played out.
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-gray-400 text-center min-h-[1em]">
        Recording preview…
      </div>
      <button
        type="button"
        onClick={ onStop }
        aria-label="Stop preview recording"
        className="relative rounded-xl px-3 py-2.5 border border-red-500/40 text-red-600 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 bg-background hover:bg-red-500/5"
      >
        <span
          aria-hidden="true"
          className="block h-2.5 w-2.5 rounded-full bg-red-500 ring-1 ring-red-500/40 animate-pulse-soft"
        />
        <span className="truncate">Stop preview</span>
      </button>
    </div>
  );
}

/**
 * The `recording` phase of an async-loop dev preview. Mirrors the regular
 * async-loop download button — a fill bar tracking the frame progress that
 * parks at 100% during encode/finalise — but its stop control cancels the
 * run and its wording reflects that this capture becomes the preview.
 */
function PreviewAsyncRecordingControls( {
  progress,
  onCancel
}: {
  progress: RecorderProgress | null;
  onCancel: () => void;
} ) {
  const progressLabel = useMemo(
    () => {
      if ( !progress ) {
        return "Recording preview…";
      }

      if ( progress.stage === "encoding" ) {
        return "Encoding…";
      }

      if ( progress.stage === "finalizing" ) {
        return "Finalising…";
      }

      const pct = progress.percentage.toFixed( 0 );

      return `${ pct }% (${ progress.frame }/${ progress.totalFrames })`;
    },
    [
      progress
    ]
  );

  const targetFillPct = progress
    ? progress.stage === "capturing"
      ? progress.percentage
      : 100
    : 0;

  const fillRef = useSmoothFill<HTMLSpanElement>(
    true,
    targetFillPct
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-gray-400 text-center min-h-[1em]">
        {progressLabel}
      </div>
      <button
        type="button"
        onClick={ onCancel }
        aria-label="Cancel preview recording"
        className="relative overflow-hidden rounded-xl px-3 py-2.5 border border-red-500/40 text-red-600 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 bg-background hover:bg-red-500/5"
      >
        <span
          ref={ fillRef }
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-red-500/20 pointer-events-none"
          style={ {
            width: "0%"
          } }
        />
        <StopCircle className="relative h-4 w-4 flex-shrink-0" />
        <span className="relative truncate">Cancel preview</span>
      </button>
    </div>
  );
}

/**
 * Deterministic capture has a known frame count. The button doubles
 * as a progress bar by tweening its fill width toward the latest
 * percentage and parking at 100% during the encode/finalise stages.
 */
function AsyncLoopRecordingControls( {
  progress,
  onCancel
}: {
  progress: RecorderProgress | null;
  onCancel: () => void;
} ) {
  const progressLabel = useMemo(
    () => {
      if ( !progress ) {
        return "Starting…";
      }

      if ( progress.stage === "encoding" ) {
        return "Encoding…";
      }

      if ( progress.stage === "finalizing" ) {
        return "Finalising…";
      }

      const pct = progress.percentage.toFixed( 0 );

      return `${ pct }% (${ progress.frame }/${ progress.totalFrames })`;
    },
    [
      progress
    ]
  );

  // Encoding + finalising park the fill at 100% so the user gets
  // "almost done" feedback while the encoder flushes.
  const targetFillPct = progress
    ? progress.stage === "capturing"
      ? progress.percentage
      : 100
    : 0;

  const fillRef = useSmoothFill<HTMLSpanElement>(
    true,
    targetFillPct
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-gray-400 text-center min-h-[1em]">
        {progressLabel}
      </div>
      <button
        type="button"
        onClick={ onCancel }
        aria-label="Cancel recording"
        className="relative overflow-hidden rounded-xl px-3 py-2.5 border border-red-500/40 text-red-600 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 bg-background hover:bg-red-500/5"
      >
        <span
          ref={ fillRef }
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-red-500/20 pointer-events-none"
          style={ {
            width: "0%"
          } }
        />
        <StopCircle className="relative h-4 w-4 flex-shrink-0" />
        <span className="relative truncate">Cancel recording</span>
      </button>
    </div>
  );
}

/**
 * Progress + cancel affordance for a still-frame sequence export. Mirrors the
 * async-loop recorder button — a fill bar tracking frame capture that parks at
 * 100% while the PNGs are zipped — since both step the sketch frame-by-frame.
 */
function FramesExportControls( {
  progress,
  onCancel
}: {
  progress: FrameExportProgress | null;
  onCancel: () => void;
} ) {
  const progressLabel = useMemo(
    () => {
      if ( !progress ) {
        return "Preparing…";
      }

      if ( progress.stage === "zipping" ) {
        return "Zipping…";
      }

      const pct = progress.percentage.toFixed( 0 );

      return `${ pct }% (${ progress.frame }/${ progress.totalFrames })`;
    },
    [
      progress
    ]
  );

  const targetFillPct = progress
    ? progress.stage === "capturing"
      ? progress.percentage
      : 100
    : 0;

  const fillRef = useSmoothFill<HTMLSpanElement>(
    true,
    targetFillPct
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-gray-400 text-center min-h-[1em]">
        {progressLabel}
      </div>
      <button
        type="button"
        onClick={ onCancel }
        aria-label="Cancel frame export"
        className="relative overflow-hidden rounded-xl px-3 py-2.5 border border-red-500/40 text-red-600 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 bg-background hover:bg-red-500/5"
      >
        <span
          ref={ fillRef }
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-red-500/20 pointer-events-none"
          style={ {
            width: "0%"
          } }
        />
        <StopCircle className="relative h-4 w-4 flex-shrink-0" />
        <span className="relative truncate">Cancel export</span>
      </button>
    </div>
  );
}
