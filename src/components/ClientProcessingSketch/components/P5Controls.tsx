import React from "react";
import {
  Camera, Github, Pause, Play
} from "lucide-react";
import Link from "next/link";

type P5ControlsProps = {
  name: string;
}

export function P5Controls({
  name
}: P5ControlsProps) {
  const [
    looping,
    setLooping
  ] = React.useState(true);

  return (
    <div className="absolute top-4 left-4 flex items-center gap-2 z-50">
      <div className="flex items-center h-9 bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md overflow-hidden">
        <Link
          href={`https://github.com/CostardRouge/p5-templates/tree/main/src/p5-sketches/sketches/${name}/index.js`}
          target="_blank"
          title="View source code"
          aria-label="View source code on GitHub"
          className="h-full px-3 hover:bg-hover transition-colors border-r border-border group inline-flex items-center justify-center"
        >
          <Github className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
        </Link>

        <button
          onClick={() => {
            window?.toggleLoop();
            setLooping(looping => !looping);
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
            window?.saveCanvas(name);
          }}
          className="h-full px-3 hover:bg-hover transition-colors group inline-flex items-center justify-center"
        >
          <Camera className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
        </button>
      </div>
    </div>
  );
}