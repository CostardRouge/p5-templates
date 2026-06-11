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
  start: (
    format: RecordingFormat,
    mode: RecordingMode
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
 * Orchestrates a single browser-side recording: builds an engine host,
 * creates the right strategy, wires progress events into React state,
 * and triggers a download on completion.
 *
 * Re-entering `start()` while a recording is active is a no-op — clicks
 * on the start button while a capture is in flight must not abort it.
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

  const recorderRef = useRef<Recorder | null>( null );

  // Keep mutable refs to the names used in completion handlers so the
  // download filename always reflects the latest sketch name, even if
  // the user renames mid-recording.
  const sketchNameRef = useRef( sketchName );

  sketchNameRef.current = sketchName;

  // The recorder strategies unconditionally call `host.pause()` then
  // `host.resume()` around the capture, which leaves the engine playing
  // regardless of the playback state the user had set before. Snapshot
  // `looping` at start and restore both the engine + React state on end
  // so the Play/Pause button matches reality after every recording.
  const [
    {
      looping
    },
    dispatch
  ] = useSketch();
  const loopingRef = useRef( looping );

  loopingRef.current = looping;
  const loopingAtStartRef = useRef<boolean>( true );
  const engineAtStartRef = useRef<SketchEngine | null>( null );

  const cleanup = useCallback(
    () => {
      recorderRef.current = null;
      setIsRecording( false );
      setProgress( null );

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
      dispatch
    ]
  );

  const start = useCallback(
    async(
      format: RecordingFormat, mode: RecordingMode
    ) => {
      if ( recorderRef.current ) {
        return;
      }

      if ( !engine ) {
        setError( new Error( "Engine not ready." ) );
        return;
      }

      setError( null );
      setProgress( null );

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
        return;
      }

      recorder.on(
        "progress",
        ( p ) => setProgress( p )
      );
      recorder.on(
        "stop",
        ( result: RecorderResult ) => {
          // Only the recorder we own should be allowed to trigger a
          // download — guards against late events from a cancelled
          // run racing with a new one.
          if ( recorderRef.current !== recorder ) {
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
      // Snapshot the engine + intended playback state before the recorder
      // takes over. The strategies always end with `host.resume()`, so
      // without this snapshot a sketch that was paused before recording
      // would come back playing with a stale Pause icon.
      engineAtStartRef.current = engine;
      loopingAtStartRef.current = loopingRef.current;
      setIsRecording( true );
      dispatch( {
        type: "SET_BROWSER_RECORDING",
        payload: true
      } );

      try {
        await recorder.start();
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
      dispatch
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
      recorderRef.current?.cancel();
    },
    []
  );

  // On unmount, abort any in-flight capture so the host engine isn't
  // left paused with a dangling mirror loop.
  useEffect(
    () => () => {
      recorderRef.current?.cancel();
      recorderRef.current = null;
    },
    []
  );

  return {
    isRecording,
    progress,
    error,
    start,
    stop,
    cancel
  };
}
