import React from "react";
import {
  Camera, Pause, Play, ToggleLeft, ToggleRight
} from "lucide-react";

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

  const [
    fps,
    setFps
  ] = React.useState( true );

  return (
    <div
      className="absolute p-2 top-0 left-0 flex gap-1 z-50"
    >
      <>
        <button
          title="Show/Hide FPS"
          onClick={() => {
            window?.toggleFPS();
            setFps( fps => !fps );
          }}
          className="rounded bg-background border border-theme border-b-2 px-2 py-1 text-sm text-foreground"
        >
          {fps ? <ToggleLeft className="h-4"/> : <ToggleRight className="h-4"/>}
        </button>

        <button
          onClick={() => {
            window?.toggleLoop();
            setLooping( looping => !looping );
          }}
          title="Toogle drawing loop"

          className="rounded bg-background border border-theme border-b-2 px-2 py-1 text-sm text-foreground "
        >
          {looping ? <Pause className="h-4"/> : <Play className="h-4"/>}
        </button>

        <button
          title="Save canvas"
          onClick={() => {
            window?.saveCanvas( name );
          }}
          className="rounded bg-background border border-theme border-b-2 px-2 py-1 text-sm text-foreground "
        >
          <Camera className="h-4"/>
        </button>
      </>
    </div>
  );
}