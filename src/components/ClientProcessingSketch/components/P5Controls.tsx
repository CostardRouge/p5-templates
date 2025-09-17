import React from "react";
import {
  Camera, Play, Pause, ToggleLeft, ToggleRight
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
      className="text-center absolute p-2 bg-white border-t-0 border border-gray-400 shadow shadow-black-300 drop-shadow-sm rounded-br-sm border-l-0 top-0 left-0 flex gap-1 z-50"
    >
      <>
        <button
          title="Show/Hide FPS"
          onClick={() => {
            window?.toggleFPS();
            setFps( fps => !fps );
          }}
          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
        >
          {fps ? <ToggleLeft className="h-4"/> : <ToggleRight className="h-4"/>}
        </button>
        <button
          onClick={() => {
            window?.toggleLoop();
            setLooping( looping => !looping );
          }}
          title="Toogle drawing loop"

          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
        >
          {looping ? <Pause className="h-4"/> : <Play className="h-4"/>}
        </button>

        <button
          title="Save canvas"
          onClick={() => {
            window?.saveCanvas( name );
          }}
          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
        >
          <Camera className="h-4"/>
        </button>
      </>
    </div>
  );
}