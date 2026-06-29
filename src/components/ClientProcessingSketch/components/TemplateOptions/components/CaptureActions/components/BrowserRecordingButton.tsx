"use client";

import React, {
  useMemo, useState
} from "react";
import {
  Loader2, StopCircle
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

// Dev-only group: a realtime webm capture that, instead of downloading,
// is saved back over the sketch's committed preview after a 3-2-1 lead-in.
// Lets interactive sketches (webcam / mic / hand tracking) get a real
// preview the headless generator can't produce.
const PREVIEW_GROUP_LABEL = "Record preview (dev)";
const IS_DEV = process.env.NODE_ENV === "development";

// One <option> per group entry. The composite value carries everything
// `start()` needs; including the group label in the visible text keeps the
// active choice readable without re-opening the dropdown.
type Choice = {
  format: RecordingFormat;
  mode: RecordingMode;
  intent: RecordingIntent;
};

type RecordingGroup = {
  key: string;
  label: string;
  mode: RecordingMode;
  intent: RecordingIntent;
  formats: RecordingFormat[];
};

function encodeChoice( c: Choice ): string {
  return `${ c.format }|${ c.mode }|${ c.intent }`;
}

function decodeChoice( value: string ): Choice {
  const [
    format,
    mode,
    intent
  ] = value.split( "|" ) as [ RecordingFormat, RecordingMode, RecordingIntent ];

  return {
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
  onCancel
}: BrowserRecordingButtonProps ) {
  const groups = useMemo<RecordingGroup[]>(
    () => {
      const supported = new Set( capabilities.supportedFormats );

      const modeGroups: RecordingGroup[] = MODE_ORDER
        .map( ( mode ) => ( {
          key: mode,
          label: MODE_LABEL[ mode ],
          mode,
          intent: "download" as RecordingIntent,
          formats: MODE_FORMATS[ mode ].filter( ( f ) => supported.has( f ) )
        } ) )
        .filter( ( g ) => g.formats.length > 0 );

      if ( IS_DEV && supported.has( "webm" ) ) {
        modeGroups.push( {
          key: "preview",
          label: PREVIEW_GROUP_LABEL,
          mode: "realtime",
          intent: "preview",
          formats: [
            "webm"
          ]
        } );
      }

      return modeGroups;
    },
    [
      capabilities.supportedFormats
    ]
  );

  const defaultChoice: Choice = useMemo(
    () => {
      const preferredMode = capabilities.defaultMode;
      const group =
        groups.find( ( g ) => g.intent === "download" && g.mode === preferredMode ) ??
          groups.find( ( g ) => g.intent === "download" ) ??
          groups[ 0 ];

      return {
        mode: group?.mode ?? "async-loop",
        format: group?.formats[ 0 ] ?? "webm",
        intent: group?.intent ?? "download"
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

  // A dev "Record preview" run drives its own countdown → recording →
  // saving controls, distinct from the regular realtime / async-loop UI.
  if ( previewPhase ) {
    return (
      <PreviewRecordingControls
        phase={ previewPhase }
        countdown={ countdown }
        onStop={ onStop }
        onCancel={ onCancel }
      />
    );
  }

  if ( isRecording ) {
    const isRealtime = choice.mode === "realtime";

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
          className="flex-1 px-2 py-2 bg-background text-foreground text-xs focus:outline-none"
          aria-label="Recording format"
        >
          {groups.map( ( group ) => (
            <optgroup key={ group.key } label={ group.label }>
              {group.formats.map( ( f ) => (
                <option
                  key={ `${ group.key }-${ f }` }
                  value={ encodeChoice( {
                    format: f,
                    mode: group.mode,
                    intent: group.intent
                  } ) }
                >
                  {formatChoiceLabel(
                    group.label,
                    f
                  )}
                </option>
              ) )}
            </optgroup>
          ) )}
        </select>

        <button
          type="button"
          onClick={ () => onStart(
            choice.format,
            choice.mode,
            choice.intent
          ) }
          aria-label="Start recording"
          title="Start recording"
          className="border-l px-2 text-foreground hover:bg-hover transition-colors inline-flex items-center justify-center"
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

      {error && (
        <div className="text-[10px] text-red-500">
          {error.message}
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
 * Dev "Record preview" lifecycle. A lead-in countdown gives the author
 * time to get an interaction (webcam / mic / hand tracking) ready; the
 * capture then runs for a fixed length and auto-stops; finally the clip is
 * re-encoded server-side into the committed preview variants.
 */
function PreviewRecordingControls( {
  phase,
  countdown,
  onStop,
  onCancel
}: {
  phase: PreviewPhase;
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
