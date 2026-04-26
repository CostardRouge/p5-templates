"use client";

import React from "react";
import {
  Camera, Github, Pause, Play
} from "lucide-react";
import Link from "next/link";
import {
  resolveSketchPath
} from "@/engines/metadata";
import useSketch from "../ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

/**
 * Engine-agnostic playback controls.
 *
 * Uses the `SketchEngine` instance from context rather than calling
 * p5-specific globals like `window.toggleLoop()`.
 */
export function EngineControls( ) {
  const [
    {
      engineId, name, engine
    }
  ] = useSketch();
  const [
    looping,
    setLooping
  ] = React.useState( true );

  const githubRepoUrl = process.env.NEXT_PUBLIC_GITHUB_REPO_URL;
  const sketchPath = githubRepoUrl ? resolveSketchPath(
    name,
    engineId
  ) : undefined;
  const githubUrl =
    githubRepoUrl && sketchPath
      ? `${ githubRepoUrl }/blob/main/src/templates/${ engineId }/sketches/${ sketchPath }/index.js`
      : undefined;

  return (
    <div className="absolute top-2 left-2 md:top-4 md:left-4 flex items-center gap-2 z-50">
      <div className="flex items-center h-9 bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md overflow-hidden">
        { githubUrl && (
          <Link
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View source code on GitHub"
            aria-label="View source code on GitHub"
            className="h-full px-3 hover:bg-hover transition-colors border-r border-border group inline-flex items-center justify-center"
          >
            <Github className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
          </Link>
        ) }
        <button
          onClick={() => {
            if ( looping ) {
              engine?.pause();
            } else {
              engine?.play();
            }

            setLooping( ( prev ) => !prev );
          }}
          title={looping ? "Pause animation" : "Play animation"}
          aria-label={looping ? "Pause animation" : "Play animation"}
          className="h-full px-3 hover:bg-hover transition-colors border-r border-border group inline-flex items-center justify-center"
        >
          {looping ? (
            <Pause className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
          ) : (
            <Play className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
          )}
        </button>

        <button
          title="Save canvas as image"
          aria-label="Save canvas as image"
          onClick={() => {
            const canvas = engine?.getCanvas();

            if ( canvas ) {
              const link = document.createElement( "a" );

              link.download = `${ name }.png`;
              link.href = canvas.toDataURL( "image/png" );
              link.click();
            }
          }}
          className="h-full px-3 hover:bg-hover transition-colors group inline-flex items-center justify-center"
        >
          <Camera className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
        </button>
      </div>

      <span className="text-xs text-foreground/50 font-mono">{engineId}</span>
    </div>
  );
}
