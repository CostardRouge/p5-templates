"use client";

import React, {
  useEffect, useMemo, useRef, useState
} from "react";
import {
  StopCircle
} from "lucide-react";
import type {
  RecorderCapabilities, RecorderProgress, RecordingFormat, RecordingMode
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

  // Target fill % for the red progress bar inside the button. Computed
  // synchronously from `progress` so it tracks the freshest React commit,
  // but the actual animation is driven imperatively below (see fillRef
  // effect) to stay smooth even when React batches many progress events
  // into a single commit on fast captures.
  const targetFillPct = progress
    ? progress.stage === "capturing"
      ? progress.percentage
      : 100
    : 0;

  // Imperative rAF tween for the fill bar. The bar always smoothly
  // catches up to `targetFillPct`, regardless of how often React commits
  // — fixes "no feedback at all" on very fast recordings (where React
  // may only commit once) and "jumps unevenly" on bursty progress
  // streams (where setState calls collapse).
  const fillRef = useRef<HTMLSpanElement>( null );
  const targetFillRef = useRef( targetFillPct );

  targetFillRef.current = targetFillPct;

  useEffect(
    () => {
      if ( !isRecording ) {
        return;
      }

      let rafId = 0;
      let current = 0;

      const tick = () => {
        const target = targetFillRef.current;
        const diff = target - current;

        // ~15% of the gap per frame ⇒ ≈200 ms to converge, matching
        // the previous CSS transition's feel.
        current = Math.abs( diff ) < 0.1 ? target : current + diff * 0.15;

        if ( fillRef.current ) {
          fillRef.current.style.width = `${ current }%`;
        }

        rafId = requestAnimationFrame( tick );
      };

      rafId = requestAnimationFrame( tick );

      return () => cancelAnimationFrame( rafId );
    },
    [
      isRecording
    ]
  );

  if ( isRecording ) {
    const isRealtime = choice.mode === "realtime";

    return (
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-400 text-center min-h-[1em]">
          {progressLabel ?? ( isRealtime ? "Recording…" : "Starting…" )}
        </div>
        <button
          type="button"
          onClick={ isRealtime ? onStop : onCancel }
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
          <span className="relative truncate">
            {isRealtime ? "Stop recording" : "Cancel recording"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-stretch gap-1 rounded-xl border border-border overflow-hidden bg-background">
        {/* <label htmlFor="recording-format" className="visibility px-2 py-2 text-xs text-foreground inline-flex items-center">*/}
        {/*  Record in*/}
        {/* </label>*/}

        <select
          id="recording-format"
          value={ encodeChoice( choice ) }
          onChange={ ( e ) => setChoice( decodeChoice( e.target.value ) ) }
          className="flex-1 px-2 py-2 bg-background text-foreground text-xs focus:outline-none border-l_"
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
