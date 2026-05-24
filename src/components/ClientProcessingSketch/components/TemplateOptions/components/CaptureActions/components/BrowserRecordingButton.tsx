"use client";

import React, {
  useMemo, useState
} from "react";
import {
  StopCircle
} from "lucide-react";
import type {
  RecorderCapabilities, RecorderProgress, RecordingFormat, RecordingMode
} from "@/engines/recording";
import {
  useSmoothFill
} from "@/hooks/useSmoothFill";

type BrowserRecordingButtonProps = {
  capabilities: RecorderCapabilities;
  isRecording: boolean;
  progress: RecorderProgress | null;
  error: Error | null;
  onStart: (
    format: RecordingFormat,
    mode: RecordingMode
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

// Composite value encoded in <option value=...>. One option per
// (format, mode) pair, grouped by mode via <optgroup>. Including the
// mode in the visible label too — "Realtime: .mp4" — keeps the active
// choice readable without re-opening the dropdown.
type Choice = {
  format: RecordingFormat;
  mode: RecordingMode;
};

function encodeChoice( c: Choice ): string {
  return `${ c.format }|${ c.mode }`;
}

function decodeChoice( value: string ): Choice {
  const [
    format,
    mode
  ] = value.split( "|" ) as [ RecordingFormat, RecordingMode ];

  return {
    format,
    mode
  };
}

function formatChoiceLabel(
  mode: RecordingMode, format: RecordingFormat
): string {
  return `${ MODE_LABEL[ mode ] }: ${ FORMAT_LABEL[ format ] }`;
}

export default function BrowserRecordingButton( {
  capabilities,
  isRecording,
  progress,
  error,
  onStart,
  onStop,
  onCancel
}: BrowserRecordingButtonProps ) {
  const groups = useMemo<{ mode: RecordingMode;
    formats: RecordingFormat[] }[]>(
    () => {
      const supported = new Set( capabilities.supportedFormats );

      return MODE_ORDER
        .map( ( mode ) => ( {
          mode,
          formats: MODE_FORMATS[ mode ].filter( ( f ) => supported.has( f ) )
        } ) )
        .filter( ( g ) => g.formats.length > 0 );
    },
    [
      capabilities.supportedFormats
    ]
  );

  const defaultChoice: Choice = useMemo(
    () => {
      const preferredMode = capabilities.defaultMode;
      const group = groups.find( ( g ) => g.mode === preferredMode ) ?? groups[ 0 ];

      return {
        mode: group?.mode ?? "async-loop",
        format: group?.formats[ 0 ] ?? "webm"
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
            <optgroup key={ group.mode } label={ MODE_LABEL[ group.mode ] }>
              {group.formats.map( ( f ) => (
                <option
                  key={ `${ group.mode }-${ f }` }
                  value={ encodeChoice( {
                    format: f,
                    mode: group.mode
                  } ) }
                >
                  {formatChoiceLabel(
                    group.mode,
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
            choice.mode
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
