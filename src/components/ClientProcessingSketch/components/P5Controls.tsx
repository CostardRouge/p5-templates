import React from "react";
import {
  Camera, Pause, Play, Github
} from "lucide-react";

import clsx from "clsx";
import Link from "next/link";

type P5ControlsProps = {
  name: string;
}

export function P5Controls( {
  name
}: P5ControlsProps ) {
  const [
    looping,
    setLooping
  ] = React.useState( true );

  return (
    <div
      className="absolute top-2 left-2 flex gap-1 z-50"
    >
      <Link
        href={`https://github.com/CostardRouge/p5-templates/tree/main/src/p5-sketches/sketches/${ name }/index.js`}
        target="_blank"
        title="See source code of this sketch"
        className="rounded-xl glass border border-theme border-b-2 px-2 py-1 text-sm text-foreground "
      >
        <Github className="h-4"/>
      </Link>

      <button
        onClick={() => {
          window?.toggleLoop();
          setLooping( looping => !looping );
        }}
        title="Toogle drawing loop"

        className="rounded-xl glass border border-theme border-b-2 px-2 py-1 text-sm text-foreground "
      >
        {looping ? <Pause className="h-4"/> : <Play className="h-4"/>}
      </button>

      <button
        title="Save canvas"
        onClick={() => {
          window?.saveCanvas( name );
        }}
        className="rounded-xl glass border border-theme border-b-2 px-2 py-1 text-sm text-foreground "
      >
        <Camera className="h-4"/>
      </button>
    </div>
  );
}