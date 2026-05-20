"use client";

import {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  createEngineHost,
  createRecorder,
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
      document.body.removeChild( a );
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
 * Re-entering `start()` while a recording is active is a no-op.
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

  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>( null );

  const cleanup = useCallback(
    () => {
      recorderRef.current = null;
      setIsRecording( false );
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

      let recorder: ReturnType<typeof createRecorder>;

      try {
        recorder = createRecorder( {
          host,
          format,
          mode
        } );
      } catch( e ) {
        const err = e instanceof Error ? e : new Error( String( e ) );

        setError( err );
        return;
      }

      recorder.on(
        "progress",
        ( p ) => setProgress( p )
      );
      recorder.on(
        "stop",
        ( result: RecorderResult ) => {
          const fileName = `${ sketchName || "sketch" }.${ result.fileExtension }`;

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
          setError( e );
          cleanup();
        }
      );
      recorder.on(
        "cancel",
        () => {
          cleanup();
        }
      );

      recorderRef.current = recorder;
      setIsRecording( true );

      try {
        await recorder.start();
      } catch( e ) {
        const err = e instanceof Error ? e : new Error( String( e ) );

        setError( err );
        cleanup();
      }
    },
    [
      engine,
      options,
      activeSlideIndex,
      sketchName,
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
        // already handled via on("error")
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
