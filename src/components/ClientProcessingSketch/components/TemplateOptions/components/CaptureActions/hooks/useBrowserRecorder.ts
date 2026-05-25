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

  const cleanup = useCallback(
    () => {
      recorderRef.current = null;
      setIsRecording( false );
      setProgress( null );
    },
    []
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
      setIsRecording( true );

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
      cleanup
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
