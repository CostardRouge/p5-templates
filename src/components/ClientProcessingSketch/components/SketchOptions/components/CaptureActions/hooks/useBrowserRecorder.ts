"use client";

import {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  createEngineHost,
  createRecorder,
  type Recorder,
  type RecorderProgress,
  type RecorderResult,
  type RecordingFormat,
  type RecordingMode
} from "@/engines/recording";
import type {
  SketchEngine
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  PREVIEW_COUNTDOWN_SECS, PREVIEW_SECS
} from "@/lib/previewConfig";

/**
 * `download` – the default browser recording: capture, then hand the file
 *              to the user via a download.
 * `preview`  – dev-only. Capture a preview clip and POST it back to the dev
 *              server, which re-encodes it into the sketch's committed
 *              `preview.webm` variants instead of downloading anything. Two
 *              flavours, chosen by the recording `mode`:
 *                • realtime   – after a 3-2-1 countdown, a fixed-length
 *                  wall-clock capture. Lets interactive sketches (webcam /
 *                  mic / hand tracking) get a real preview the headless
 *                  generator can't produce.
 *                • async-loop – a deterministic frame-by-frame capture of the
 *                  sketch's loop. No countdown (nothing to prepare) and no
 *                  frame drops — the front-end equivalent of the headless
 *                  generator, handy when it isn't available.
 */
export type RecordingIntent = "download" | "preview";

/**
 * UI phase of a dev "Record preview" run. `countdown` only applies to the
 * realtime flavour; async-loop previews go straight to `recording`.
 */
export type PreviewPhase = "countdown" | "recording" | "saving";

export type UseBrowserRecorderArgs = {
  engine: SketchEngine | null;
  options: SketchOption;
  activeSlideIndex?: number;
  sketchName: string;
};

export type UseBrowserRecorderReturn = {
  isRecording: boolean;
  progress: RecorderProgress | null;
  error: Error | null;
  /** Non-null while a dev "Record preview" run is in flight. */
  previewPhase: PreviewPhase | null;
  /** Remaining whole seconds during the `countdown` phase. */
  countdown: number;
  /** Briefly true after a preview was written to the source tree. */
  previewSaved: boolean;
  start: (
    format: RecordingFormat,
    mode: RecordingMode,
    intent?: RecordingIntent
  ) => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => void;
};

function triggerDownload(
  blob: Blob, filename: string
) {
  const url = URL.createObjectURL( blob );
  const a = document.createElement( "a" );

  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild( a );
  a.click();
  setTimeout(
    () => {
      a.remove();
      URL.revokeObjectURL( url );
    },
    100
  );
}

/**
 * POST a recorded preview clip back to the dev server, which re-encodes it
 * into the sketch's committed preview variants. Throws on a non-2xx so the
 * caller can surface the message.
 */
async function savePreviewBlob(
  blob: Blob, sketchName: string, engineId: string
): Promise<void> {
  const form = new FormData();

  form.append(
    "video",
    blob,
    `${ sketchName || "sketch" }.webm`
  );
  form.append(
    "sketch",
    sketchName
  );
  form.append(
    "engineId",
    engineId
  );

  const res = await fetch(
    "/api/dev/previews/save-from-blob",
    {
      method: "POST",
      body: form
    }
  );

  if ( !res.ok ) {
    const text = await res.text();

    throw new Error( text || `HTTP ${ res.status }` );
  }
}

/**
 * Orchestrates a single browser-side recording: builds an engine host,
 * creates the right strategy, wires progress events into React state, and
 * either triggers a download (`download` intent) or — dev-only, after a
 * lead-in countdown — saves the clip back to the source tree as the
 * sketch's preview (`preview` intent).
 *
 * Re-entering `start()` while a recording (or its countdown) is active is a
 * no-op — clicks on the start button while a capture is in flight must not
 * abort it.
 */
export function useBrowserRecorder( {
  engine,
  options,
  activeSlideIndex,
  sketchName
}: UseBrowserRecorderArgs ): UseBrowserRecorderReturn {
  const [
    isRecording,
    setIsRecording
  ] = useState( false );
  const [
    progress,
    setProgress
  ] = useState<RecorderProgress | null>( null );
  const [
    error,
    setError
  ] = useState<Error | null>( null );
  const [
    previewPhase,
    setPreviewPhase
  ] = useState<PreviewPhase | null>( null );
  const [
    countdown,
    setCountdown
  ] = useState( 0 );
  const [
    previewSaved,
    setPreviewSaved
  ] = useState( false );

  const recorderRef = useRef<Recorder | null>( null );

  // Keep mutable refs to the names used in completion handlers so the
  // download filename / preview target always reflect the latest values,
  // even if the user renames mid-recording.
  const sketchNameRef = useRef( sketchName );

  sketchNameRef.current = sketchName;

  // The recorder strategies unconditionally call `host.pause()` then
  // `host.resume()` around the capture, which leaves the engine playing
  // regardless of the playback state the user had set before. Snapshot
  // `looping` at start and restore both the engine + React state on end
  // so the Play/Pause button matches reality after every recording.
  const [
    {
      looping, engineId
    },
    dispatch
  ] = useSketch();
  const loopingRef = useRef( looping );

  loopingRef.current = looping;
  const engineIdRef = useRef( engineId );

  engineIdRef.current = engineId;
  const loopingAtStartRef = useRef<boolean>( true );
  const engineAtStartRef = useRef<SketchEngine | null>( null );

  // Lead-in countdown bookkeeping. `previewActiveRef` is set the instant a
  // preview run begins (before any recorder exists) so `cancel()` can abort
  // a run that's still counting down. `countdownRejectRef` settles the
  // pending countdown promise when that happens so `start()` doesn't hang.
  const previewActiveRef = useRef( false );
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>( null );
  const countdownRejectRef = useRef<( () => void ) | null>( null );
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>( null );

  const clearCountdown = useCallback(
    () => {
      if ( countdownTimerRef.current ) {
        clearTimeout( countdownTimerRef.current );
        countdownTimerRef.current = null;
      }

      if ( countdownRejectRef.current ) {
        const reject = countdownRejectRef.current;

        countdownRejectRef.current = null;
        reject();
      }
    },
    []
  );

  const cleanup = useCallback(
    () => {
      recorderRef.current = null;
      previewActiveRef.current = false;
      clearCountdown();
      setIsRecording( false );
      setProgress( null );
      setPreviewPhase( null );
      setCountdown( 0 );

      // Restore engine playback to what it was before recording started.
      // The strategies always leave the engine resumed in teardown, so a
      // user who was paused would otherwise come back to a playing engine
      // with a stale paused button.
      const startEngine = engineAtStartRef.current;
      const wasLooping = loopingAtStartRef.current;

      if ( startEngine ) {
        try {
          if ( wasLooping ) {
            startEngine.play();
          } else {
            startEngine.pause();
          }
        } catch {
          // Restoring playback must never throw — recorder lifecycle
          // events are still in flight when this runs.
        }
      }

      engineAtStartRef.current = null;

      dispatch( {
        type: "SET_LOOPING",
        payload: wasLooping
      } );
      dispatch( {
        type: "SET_BROWSER_RECORDING",
        payload: false
      } );
    },
    [
      dispatch,
      clearCountdown
    ]
  );

  // Resolve after `seconds` whole-second ticks (showing seconds, …, 1),
  // or reject if the run is cancelled mid-countdown.
  const runCountdown = useCallback(
    ( seconds: number ): Promise<void> => new Promise<void>( (
      resolve, reject
    ) => {
      let remaining = seconds;

      setCountdown( remaining );
      countdownRejectRef.current = () => reject( new Error( "Countdown cancelled." ) );

      const tick = () => {
        remaining -= 1;

        if ( remaining <= 0 ) {
          countdownRejectRef.current = null;
          setCountdown( 0 );
          resolve();

          return;
        }

        setCountdown( remaining );
        countdownTimerRef.current = setTimeout(
          tick,
          1000
        );
      };

      countdownTimerRef.current = setTimeout(
        tick,
        1000
      );
    } ),
    []
  );

  // Persist a finished preview clip instead of downloading it.
  const handlePreviewStop = useCallback(
    async( blob: Blob ) => {
      setPreviewPhase( "saving" );

      try {
        await savePreviewBlob(
          blob,
          sketchNameRef.current,
          engineIdRef.current
        );
        cleanup();
        setPreviewSaved( true );

        if ( savedTimerRef.current ) {
          clearTimeout( savedTimerRef.current );
        }

        savedTimerRef.current = setTimeout(
          () => setPreviewSaved( false ),
          2500
        );
      } catch( e ) {
        setError( e instanceof Error ? e : new Error( String( e ) ) );
        cleanup();
      }
    },
    [
      cleanup
    ]
  );

  const start = useCallback(
    async(
      format: RecordingFormat,
      mode: RecordingMode,
      intent: RecordingIntent = "download"
    ) => {
      if ( recorderRef.current || previewActiveRef.current ) {
        return;
      }

      if ( !engine ) {
        setError( new Error( "Engine not ready." ) );
        return;
      }

      setError( null );
      setProgress( null );
      setPreviewSaved( false );

      if ( savedTimerRef.current ) {
        clearTimeout( savedTimerRef.current );
        savedTimerRef.current = null;
      }

      const isPreview = intent === "preview";
      // Realtime previews lead in with a 3-2-1 countdown so the author can get
      // an interaction (webcam / mic / hand tracking) ready. Async-loop
      // previews are deterministic — nothing to prepare — so they skip the
      // countdown and step straight into a frame-by-frame capture.
      const isRealtimePreview = isPreview && mode === "realtime";

      // Preview runs lock controls *before* a recorder exists so the author
      // can (realtime) get an interaction ready and still cancel cleanly.
      // The download path keeps the original ordering (lock only once the
      // recorder is built) so a failed `createRecorder` can't leave the
      // controls stuck — there's nothing to clean up there yet.
      if ( isPreview ) {
        previewActiveRef.current = true;
        // Snapshot the engine + intended playback state before anything
        // takes over. The strategies always end with `host.resume()`, so
        // without this snapshot a sketch that was paused before recording
        // would come back playing with a stale Pause icon.
        engineAtStartRef.current = engine;
        loopingAtStartRef.current = loopingRef.current;
        dispatch( {
          type: "SET_BROWSER_RECORDING",
          payload: true
        } );

        if ( isRealtimePreview ) {
          setPreviewPhase( "countdown" );

          try {
            await runCountdown( PREVIEW_COUNTDOWN_SECS );
          } catch {
            // Cancelled during the countdown — `cancel()` already cleaned up.
            return;
          }

          if ( !previewActiveRef.current ) {
            return;
          }
        }
      }

      const host = createEngineHost(
        engine,
        options,
        activeSlideIndex
      );

      let recorder: Recorder;

      try {
        recorder = createRecorder( {
          host,
          format,
          mode
        } );
      } catch( e ) {
        setError( e instanceof Error ? e : new Error( String( e ) ) );

        if ( isPreview ) {
          cleanup();
        }

        return;
      }

      recorder.on(
        "progress",
        ( p ) => setProgress( p )
      );
      recorder.on(
        "stop",
        ( result: RecorderResult ) => {
          // Only the recorder we own should be allowed to finish — guards
          // against late events from a cancelled run racing with a new one.
          if ( recorderRef.current !== recorder ) {
            return;
          }

          if ( isPreview ) {
            void handlePreviewStop( result.blob );

            return;
          }

          const safeName = sketchNameRef.current || "sketch";
          const fileName = `${ safeName }.${ result.fileExtension }`;

          triggerDownload(
            result.blob,
            fileName
          );
          cleanup();
        }
      );
      recorder.on(
        "error",
        ( e: Error ) => {
          if ( recorderRef.current !== recorder ) {
            return;
          }
          setError( e );
          cleanup();
        }
      );
      recorder.on(
        "cancel",
        () => {
          if ( recorderRef.current !== recorder ) {
            return;
          }
          cleanup();
        }
      );

      recorderRef.current = recorder;
      // Snapshot + lock now for the download path (idempotent for preview,
      // which already did both before the countdown).
      engineAtStartRef.current = engine;
      loopingAtStartRef.current = loopingRef.current;
      setIsRecording( true );

      if ( isPreview ) {
        setPreviewPhase( "recording" );
      }

      dispatch( {
        type: "SET_BROWSER_RECORDING",
        payload: true
      } );

      try {
        // Realtime previews auto-stop after the canonical preview length so
        // every committed loop is the same duration. Async-loop previews run
        // the sketch's deterministic loop to completion and rely on ffmpeg to
        // trim to the canonical length when re-encoding.
        await recorder.start( isRealtimePreview
          ? {
            maxDurationMs: PREVIEW_SECS * 1000
          }
          : undefined );
      } catch( e ) {
        // start() failures emit "error" already — but a synchronous
        // throw before any listener fires would leave us stuck.
        if ( recorderRef.current === recorder ) {
          setError( e instanceof Error ? e : new Error( String( e ) ) );
          cleanup();
        }
      }
    },
    [
      engine,
      options,
      activeSlideIndex,
      cleanup,
      dispatch,
      runCountdown,
      handlePreviewStop
    ]
  );

  const stop = useCallback(
    async() => {
      const recorder = recorderRef.current;

      if ( !recorder ) {
        return;
      }

      try {
        await recorder.stop();
      } catch {
        // Already handled via on("error").
      }
    },
    []
  );

  const cancel = useCallback(
    () => {
      // An active recorder cancels through its own lifecycle (→ cleanup).
      if ( recorderRef.current ) {
        recorderRef.current.cancel();

        return;
      }

      // Otherwise we may still be in a preview lead-in countdown that hasn't
      // created a recorder yet — tear that down directly.
      if ( previewActiveRef.current ) {
        cleanup();
      }
    },
    [
      cleanup
    ]
  );

  // On unmount, abort any in-flight capture so the host engine isn't
  // left paused with a dangling mirror loop, and drop pending timers.
  useEffect(
    () => () => {
      recorderRef.current?.cancel();
      recorderRef.current = null;

      if ( countdownTimerRef.current ) {
        clearTimeout( countdownTimerRef.current );
      }

      if ( savedTimerRef.current ) {
        clearTimeout( savedTimerRef.current );
      }
    },
    []
  );

  return {
    isRecording,
    progress,
    error,
    previewPhase,
    countdown,
    previewSaved,
    start,
    stop,
    cancel
  };
}
