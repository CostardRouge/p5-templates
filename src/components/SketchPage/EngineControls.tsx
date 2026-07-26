"use client";

import {
  Camera, Circle, Loader2, Pause, Play
} from "lucide-react";
import Github from "@/components/ui/GithubIcon";
import Link from "next/link";
import {
  useRef, useState
} from "react";
import clsx from "clsx";
import {
  resolveSketchPath
} from "@/engines/metadata";
import useSketch from "../ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import SketchShareDialog from "./SketchShareDialog";
import {
  OPEN_EXPORT_DRAWER_EVENT
} from "../ClientProcessingSketch/components/SketchOptions/constants/drawer-events";

type ThumbnailSaveState = "idle" | "saving" | "done" | "error";

/**
 * Engine-agnostic playback controls.
 *
 * Uses the `SketchEngine` instance from context rather than calling
 * p5-specific globals like `window.toggleLoop()`.
 *
 * `variant` "floating" (default) renders the rounded island anchored to the
 * top-left of the viewport; "bar" renders the buttons flat for hosting inside
 * the docked workspace top bar, which supplies the surface.
 */
export function EngineControls( {
  variant = "floating"
}: {
  variant?: "floating" | "bar";
} = {} ) {
  const [
    {
      engineId, name, engine, looping, browserRecording
    },
    dispatch
  ] = useSketch();

  const [
    thumbnailSaveState,
    setThumbnailSaveState
  ] = useState<ThumbnailSaveState>( "idle" );
  const [
    thumbnailErrorMessage,
    setThumbnailErrorMessage
  ] = useState<string | null>( null );

  const isDev = process.env.NODE_ENV === "development";
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>( null );

  /**
   * Grab the current frame as a PNG data-URL. Uses the engine's capture source
   * so DOM engines (GSAP/HTML) re-rasterise the live DOM on demand — the mirror
   * canvas returned by `getCanvas()` is only refreshed on redraw, so reading it
   * straight during playback yields a stale (or blank/transparent) frame.
   */
  const captureFreshPng = async(): Promise<string | null> => {
    if ( !engine ) {
      return null;
    }

    try {
      const frame = await engine.getCaptureSource().readFrame();

      if ( frame instanceof HTMLCanvasElement ) {
        return frame.toDataURL( "image/png" );
      }
    } catch {
      // Fall through to the live canvas below.
    }

    const canvas = engine.getCanvas();

    return canvas ? canvas.toDataURL( "image/png" ) : null;
  };

  const downloadCanvasAsPng = async() => {
    const dataUrl = await captureFreshPng();

    if ( dataUrl ) {
      const link = document.createElement( "a" );

      link.download = `${ name }.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const handleCaptureClick = () => {
    if ( thumbnailSaveState === "saving" ) {
      return;
    }

    // In dev, defer the download so a double-click can cancel it and trigger
    // thumbnail save instead. Outside dev, download immediately.
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

  const handleSaveCanvasAsThumbnail = async() => {
    if ( singleClickTimerRef.current ) {
      clearTimeout( singleClickTimerRef.current );
      singleClickTimerRef.current = null;
    }

    if ( !isDev || thumbnailSaveState === "saving" ) {
      return;
    }

    setThumbnailSaveState( "saving" );
    setThumbnailErrorMessage( null );

    try {
      const dataUrl = await captureFreshPng();

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

      setThumbnailSaveState( "done" );
      setTimeout(
        () => setThumbnailSaveState( "idle" ),
        1500
      );
    } catch( err ) {
      setThumbnailErrorMessage( err instanceof Error ? err.message : String( err ) );
      setThumbnailSaveState( "error" );
      setTimeout(
        () => setThumbnailSaveState( "idle" ),
        3000
      );
    }
  };

  const githubRepoUrl = process.env.NEXT_PUBLIC_GITHUB_REPO_URL;
  const sketchPath = githubRepoUrl ? resolveSketchPath(
    name,
    engineId
  ) : undefined;
  // DOM engines (GSAP/HTML) author sketches as React `.jsx`; p5 uses `.js`.
  const entryExtension = engineId === "gsap" ? "jsx" : "js";
  const githubUrl =
    githubRepoUrl && sketchPath
      ? `${ githubRepoUrl }/blob/main/src/sketches/${ engineId }/sketches/${ sketchPath }/index.${ entryExtension }`
      : undefined;

  const controls = (
    <>
      { githubUrl && (
        <Link
          href={ githubUrl }
          target="_blank"
          rel="noopener noreferrer"
          title="View source code on GitHub"
          aria-label="View source code on GitHub"
          className="hidden md:inline-flex h-full px-3 hover:bg-hover transition-colors border-r border-border group items-center justify-center"
        >
          <Github className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
        </Link>
      ) }
      <button
        onClick={ () => {
          if ( looping ) {
            engine?.pause();
          } else {
            engine?.play();
          }

          dispatch( {
            type: "SET_LOOPING",
            payload: !looping
          } );
        } }
        disabled={ browserRecording }
        title={
          browserRecording
            ? "Locked while recording"
            : looping
              ? "Pause animation"
              : "Play animation"
        }
        aria-label={ looping ? "Pause animation" : "Play animation" }
        className="h-full px-3 hover:bg-hover transition-colors border-r border-border group inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        {looping ? (
          <Pause className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
        ) : (
          <Play className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
        )}
      </button>

      <SketchShareDialog />

      <button
        title={
          thumbnailSaveState === "error"
            ? ( thumbnailErrorMessage ?? "Error" )
            : isDev
              ? "Save canvas as image (double-click: save as sketch thumbnail 1x + 2x)"
              : "Save canvas as image"
        }
        aria-label="Save canvas as image"
        disabled={ thumbnailSaveState === "saving" }
        onClick={ handleCaptureClick }
        onDoubleClick={ handleSaveCanvasAsThumbnail }
        className="inline-flex h-full px-3 hover:bg-hover transition-colors border-r border-border md:border-r-0 group items-center justify-center"
      >
        {thumbnailSaveState === "saving" ? (
          <Loader2 className="h-4 w-4 text-yellow-400/70 animate-spin" />
        ) : (
          <Camera
            className={ clsx(
              "h-4 w-4 transition-colors",
              {
                "text-foreground/70 group-hover:text-foreground":
                    thumbnailSaveState === "idle",
                "text-green-400":
                    thumbnailSaveState === "done",
                "text-red-400":
                    thumbnailSaveState === "error"
              }
            ) }
          />
        )}
      </button>

      {/* Mobile shortcut: opens the studio drawer on its Export tab. */}
      <button
        title="Record / export"
        aria-label="Open recording and export options"
        onClick={ () =>
          window.dispatchEvent( new CustomEvent( OPEN_EXPORT_DRAWER_EVENT ) ) }
        className="h-full px-3 hover:bg-hover transition-colors group inline-flex items-center justify-center md:hidden"
      >
        <Circle className="h-4 w-4 fill-red-500/80 text-red-500/80 transition-colors group-hover:fill-red-500 group-hover:text-red-500" />
      </button>
    </>
  );

  if ( variant === "bar" ) {
    // Full height so the buttons' dividers span the whole top bar.
    return (
      <div className="flex items-stretch h-full overflow-hidden">
        {controls}
      </div>
    );
  }

  return (
    <div className="absolute top-2 left-[3.25rem] md:top-4 md:left-[3.75rem] flex items-center gap-2 z-50">
      <div className="flex items-center h-9 bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md overflow-hidden">
        {controls}
      </div>
    </div>
  );
}
