"use client";

import React, {
  useRef, useState
} from "react";
import clsx from "clsx";
import {
  Camera, Loader2
} from "lucide-react";

import {
  captureFreshPng, downloadCanvasPng
} from "@/lib/canvasSnapshot";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

type SnapshotState = "idle" | "saving" | "done" | "error";

/**
 * The still-image half of the transport: click saves the current frame as a
 * PNG, and in development a double-click sends it to the dev thumbnail route
 * instead, which writes the sketch's catalogue thumbnail at 1x and 2x.
 *
 * It used to live in the engine-controls island, next to a second play/pause
 * and a second scrubber. Playback and capture both belong to the transport
 * now, so the whole state machine moved here — this is where to look when a
 * sketch thumbnail needs regenerating.
 *
 * The single click is deferred by 250ms in development so a double-click can
 * cancel it; outside development there is nothing to disambiguate and the
 * download fires immediately.
 */
export default function SnapshotButton() {
  const [
    {
      engineId, name, engine
    }
  ] = useSketch();

  const [
    state,
    setState
  ] = useState<SnapshotState>( "idle" );
  const [
    errorMessage,
    setErrorMessage
  ] = useState<string | null>( null );

  const isDev = process.env.NODE_ENV === "development";
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>( null );

  const downloadCanvasAsPng = () => downloadCanvasPng(
    engine,
    name
  );

  const handleClick = () => {
    if ( state === "saving" ) {
      return;
    }

    if ( !isDev ) {
      downloadCanvasAsPng();

      return;
    }

    if ( singleClickTimerRef.current ) {
      clearTimeout( singleClickTimerRef.current );
    }

    singleClickTimerRef.current = setTimeout(
      () => {
        singleClickTimerRef.current = null;
        downloadCanvasAsPng();
      },
      250
    );
  };

  const handleDoubleClick = async() => {
    if ( singleClickTimerRef.current ) {
      clearTimeout( singleClickTimerRef.current );
      singleClickTimerRef.current = null;
    }

    if ( !isDev || state === "saving" ) {
      return;
    }

    setState( "saving" );
    setErrorMessage( null );

    try {
      const dataUrl = await captureFreshPng( engine );

      if ( !dataUrl ) {
        throw new Error( "No canvas found" );
      }

      const res = await fetch(
        "/api/dev/thumbnails/save-from-canvas",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify( {
            sketch: name,
            engineId,
            imagePngBase64: dataUrl
          } )
        }
      );

      if ( !res.ok ) {
        const text = await res.text();

        throw new Error( text || `HTTP ${ res.status }` );
      }

      setState( "done" );
      setTimeout(
        () => setState( "idle" ),
        1500
      );
    } catch( err ) {
      setErrorMessage( err instanceof Error ? err.message : String( err ) );
      setState( "error" );
      setTimeout(
        () => setState( "idle" ),
        3000
      );
    }
  };

  return (
    <button
      type="button"
      onClick={ handleClick }
      onDoubleClick={ handleDoubleClick }
      disabled={ state === "saving" }
      title={
        state === "error"
          ? ( errorMessage ?? "Error" )
          : isDev
            ? "Save the current frame as a PNG (double-click: save as sketch thumbnail 1x + 2x)"
            : "Save the current frame as a PNG"
      }
      aria-label="Save the current frame as an image"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-hover disabled:cursor-not-allowed"
    >
      {state === "saving" ? (
        <Loader2 className="h-4 w-4 animate-spin text-yellow-400/70" />
      ) : (
        <Camera
          className={ clsx(
            "h-4 w-4 transition-colors",
            {
              "text-foreground": state === "idle",
              "text-green-500": state === "done",
              "text-red-400": state === "error"
            }
          ) }
        />
      )}
    </button>
  );
}
