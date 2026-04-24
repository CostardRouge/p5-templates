"use client";

import React from "react";
import { Camera, Pause, Play } from "lucide-react";
import { useEngine } from "./EngineContext";

type Props = {
  name: string;
  engineId: string;
};

/**
 * Engine-agnostic playback controls.
 *
 * Uses the `SketchEngine` instance from context rather than calling
 * p5-specific globals like `window.toggleLoop()`.
 */
export function EngineControls( { name, engineId }: Props ) {
  const engine = useEngine();
  const [looping, setLooping] = React.useState( true );

  return (
    <div className="absolute top-2 left-2 md:top-4 md:left-4 flex items-center gap-2 z-50">
      <div className="flex items-center h-9 bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md overflow-hidden">
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
