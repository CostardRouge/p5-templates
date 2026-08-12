"use client";

import {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  createEngineHost
} from "@/engines/recording";
import type {
  SketchEngine
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  createZip, type ZipEntry
} from "@/utils/clientZip";

/**
 * A fixed number of evenly-sampled frames, or every frame of the loop.
 */
export type FrameCount = number | "all";

export type FrameExportStage = "capturing" | "zipping";

export type FrameExportProgress = {
  /** 1-based index of the frame just captured. */
  frame: number;
  /** Total frames this export will grab. */
  totalFrames: number;
  percentage: number;
  stage: FrameExportStage;
};

export type UseFrameExporterArgs = {
  engine: SketchEngine | null;
  options: SketchOption;
  activeSlideIndex?: number;
  sketchName: string;
};

export type UseFrameExporterReturn = {
  isExporting: boolean;
  progress: FrameExportProgress | null;
  error: Error | null;
  exportFrames: ( count: FrameCount ) => Promise<void>;
  cancel: () => void;
};

function triggerDownload(
  blob: Blob, filename: string
) {
  const url = URL.createObjectURL( blob );
  const anchor = document.createElement( "a" );

  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild( anchor );
  anchor.click();
  setTimeout(
    () => {
      anchor.remove();
      URL.revokeObjectURL( url );
    },
    100
  );
}

function canvasToPngBytes( canvas: HTMLCanvasElement ): Promise<Uint8Array> {
  return new Promise( (
    resolve, reject
  ) => {
    canvas.toBlob(
      ( blob ) => {
        if ( !blob ) {
          reject( new Error( "Frame export: canvas.toBlob returned null." ) );

          return;
        }

        blob
          .arrayBuffer()
          .then( ( buffer ) => resolve( new Uint8Array( buffer ) ) )
          .catch( reject );
      },
      "image/png"
    );
  } );
}

/**
 * Resolve the concrete, ordered frame indices to grab. A numeric `count`
 * samples the loop evenly (start-aligned, no duplicated loop endpoint);
 * `"all"` walks every frame. Numeric counts are clamped to the available
 * frame span so short loops don't emit duplicate stills.
 */
function resolveFrameIndices(
  count: FrameCount, totalFrames: number
): number[] {
  if ( count === "all" ) {
    return Array.from(
      {
        length: totalFrames
      },
      (
        _unused, index
      ) => index
    );
  }

  const sampleCount = Math.min(
    count,
    totalFrames
  );

  return Array.from(
    {
      length: sampleCount
    },
    (
      _unused, index
    ) => Math.floor( ( index * totalFrames ) / sampleCount )
  );
}

/**
 * Client-side "export a sequence of stills" companion to `useBrowserRecorder`.
 *
 * Reuses the engine's deterministic capture path — the same `seekAndDraw`
 * machinery the async-loop video recorder uses — to render N evenly-spaced
 * frames, snapshot each as a PNG, bundle them into a single `.zip`, and hand
 * that to the user. Built for the Instagram "swipe-driven stop-motion"
 * carousel: unzip → upload the ordered frames one by one.
 *
 * Only meaningful for engines that can render arbitrary frames reproducibly
 * (`capabilities.supportsDeterministicCapture`); the UI gates on that.
 */
export function useFrameExporter( {
  engine,
  options,
  activeSlideIndex,
  sketchName
}: UseFrameExporterArgs ): UseFrameExporterReturn {
  const [
    isExporting,
    setIsExporting
  ] = useState( false );
  const [
    progress,
    setProgress
  ] = useState<FrameExportProgress | null>( null );
  const [
    error,
    setError
  ] = useState<Error | null>( null );

  const exportingRef = useRef( false );
  const cancelledRef = useRef( false );

  const [
    {
      looping
    },
    dispatch
  ] = useSketch();
  const loopingRef = useRef( looping );

  loopingRef.current = looping;

  const sketchNameRef = useRef( sketchName );

  sketchNameRef.current = sketchName;

  const exportFrames = useCallback(
    async( count: FrameCount ) => {
      // Re-entry while a capture (or a video recording that shares the engine)
      // is in flight would corrupt both — bail out silently.
      if ( exportingRef.current ) {
        return;
      }

      if ( !engine ) {
        setError( new Error( "Engine not ready." ) );

        return;
      }

      const host = createEngineHost(
        engine,
        options,
        activeSlideIndex
      );
      const totalFrames = Math.round( host.totalFrames );

      if ( !Number.isFinite( totalFrames ) || totalFrames <= 0 ) {
        setError( new Error( "This sketch has no frames to export." ) );

        return;
      }

      const indices = resolveFrameIndices(
        count,
        totalFrames
      );
      const wasLooping = loopingRef.current;

      exportingRef.current = true;
      cancelledRef.current = false;
      setError( null );
      setProgress( null );
      setIsExporting( true );
      dispatch( {
        type: "SET_BROWSER_RECORDING",
        payload: true
      } );

      const source = host.getCaptureSource();

      // Freeze the draw loop and drive time by frame index so every
      // `seekAndDraw(i)` renders at exactly t = i / frameRate.
      host.pause();
      host.beginDeterministicCapture();

      const finish = () => {
        host.endDeterministicCapture();

        // The recorder path always resumes; here we restore whatever the user
        // had before so the Play/Pause button stays truthful.
        try {
          if ( wasLooping ) {
            engine.play();
          } else {
            engine.pause();
          }
        } catch {
          // Restoring playback must never mask the export outcome.
        }

        dispatch( {
          type: "SET_LOOPING",
          payload: wasLooping
        } );
        dispatch( {
          type: "SET_BROWSER_RECORDING",
          payload: false
        } );
        exportingRef.current = false;
        setIsExporting( false );
        setProgress( null );
      };

      try {
        await host.resetToStart();

        const {
          width, height
        } = source;

        if ( !width || !height ) {
          throw new Error( "Capture surface has no dimensions." );
        }

        const scratch = document.createElement( "canvas" );

        scratch.width = width;
        scratch.height = height;

        const context = scratch.getContext( "2d" );

        if ( !context ) {
          throw new Error( "Could not acquire a 2D context for frame export." );
        }

        const padWidth = Math.max(
          2,
          String( indices.length ).length
        );
        const entries: ZipEntry[] = [];

        for ( let position = 0; position < indices.length; position++ ) {
          if ( cancelledRef.current ) {
            finish();

            return;
          }

          await host.seekAndDraw( indices[ position ] );

          const image = await source.readFrame();

          context.clearRect(
            0,
            0,
            width,
            height
          );
          context.drawImage(
            image,
            0,
            0,
            width,
            height
          );

          const bytes = await canvasToPngBytes( scratch );
          const label = String( position + 1 ).padStart(
            padWidth,
            "0"
          );

          entries.push( {
            name: `frame-${ label }.png`,
            data: bytes
          } );

          setProgress( {
            frame: position + 1,
            totalFrames: indices.length,
            percentage: ( ( position + 1 ) / indices.length ) * 100,
            stage: "capturing"
          } );
        }

        if ( cancelledRef.current ) {
          finish();

          return;
        }

        setProgress( {
          frame: indices.length,
          totalFrames: indices.length,
          percentage: 100,
          stage: "zipping"
        } );

        const zip = createZip( entries );
        const safeName = sketchNameRef.current || "sketch";
        const suffix = count === "all" ? "all" : String( count );

        triggerDownload(
          zip,
          `${ safeName }-${ width }x${ height }-frames-${ suffix }.zip`
        );

        finish();
      } catch( caught ) {
        setError( caught instanceof Error ? caught : new Error( String( caught ) ) );
        finish();
      }
    },
    [
      engine,
      options,
      activeSlideIndex,
      dispatch
    ]
  );

  const cancel = useCallback(
    () => {
      // The capture loop checks this flag between frames and tears itself down.
      cancelledRef.current = true;
    },
    []
  );

  // Abort an in-flight capture on unmount so the engine isn't left paused in
  // deterministic mode with a half-built zip.
  useEffect(
    () => () => {
      cancelledRef.current = true;
    },
    []
  );

  return {
    isExporting,
    progress,
    error,
    exportFrames,
    cancel
  };
}
