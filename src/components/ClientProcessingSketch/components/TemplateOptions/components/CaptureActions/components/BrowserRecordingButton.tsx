"use client";

import React, {
  useMemo, useState
} from "react";
import {
  Save, StopCircle
} from "lucide-react";
import type {
  RecorderCapabilities,
  RecorderProgress,
  RecordingFormat,
  RecordingMode
} from "@/engines/recording";

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
  webm: "WebM",
  gif: "GIF",
  mp4: "MP4"
};

// Composite value encoded in <option value=...>. One option per
// (format, mode) pair, grouped by mode via <optgroup>.
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

// Per-mode format availability — gif is async-loop only; webm/mp4 work
// in both modes via MediaRecorder (realtime) or mediabunny (async-loop).
const MODE_FORMATS: Record<RecordingMode, RecordingFormat[]> = {
  "async-loop": [
    "webm",
    "gif",
    "mp4"
  ],
  realtime: [
    "webm",
    "mp4"
  ]
};

const MODE_LABEL: Record<RecordingMode, string> = {
  "async-loop": "Async loop",
  realtime: "Realtime"
};

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

      return ( [
        "async-loop",
        "realtime"
      ] as const ).map( ( mode ) => ( {
        mode,
        formats: MODE_FORMATS[ mode ].filter( ( f ) => supported.has( f ) )
      } ) ).filter( ( g ) => g.formats.length > 0 );
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

  const progressLabel = useMemo(
    () => {
      if ( !progress ) {
        return null;
      }

      const pct = progress.percentage.toFixed( 0 );

      if ( progress.stage === "capturing" ) {
        return `${ pct }% (${ progress.frame }/${ progress.totalFrames })`;
      }

      if ( progress.stage === "encoding" ) {
        return "Encoding…";
      }

      return "Finalising…";
    },
    [
      progress
    ]
  );

  if ( isRecording ) {
    const isRealtime = choice.mode === "realtime";

    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={ isRealtime ? onStop : onCancel }
          className="rounded-xl px-3 py-2.5 border border-red-500/30 text-red-500 bg-background hover:bg-hover text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5"
        >
          <StopCircle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {isRealtime ? "Stop recording" : "Cancel recording"}
          </span>
        </button>
        {progressLabel && (
          <div className="text-[10px] text-gray-400 text-center">
            {progressLabel}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-stretch gap-1 rounded-xl border border-border overflow-hidden bg-background">
        <span className="px-1 py-2.5 text-xs text-foreground inline-flex items-center pl-2">
          Record in
        </span>
        <select
          value={ encodeChoice( choice ) }
          onChange={ ( e ) => setChoice( decodeChoice( e.target.value ) ) }
          className="flex-1 px-1 py-2.5 bg-background text-foreground text-xs focus:outline-none"
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
                  {FORMAT_LABEL[ f ]}
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
          className="px-1 py-2.5 pr-2 text-foreground hover:bg-hover transition-colors inline-flex items-center justify-center"
        >
          <Save className="h-4 w-4 flex-shrink-0" />
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
