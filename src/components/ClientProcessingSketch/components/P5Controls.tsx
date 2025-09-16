import React from "react";
import {
  Camera, Pause, Shuffle, ToggleLeft
} from "lucide-react";

export function P5Controls( {

} ) {
  return (
    <div
      className="text-center absolute p-2 bg-white border-t-0 border border-gray-400 shadow shadow-black-300 drop-shadow-sm rounded-br-sm border-l-0 top-0 left-0 flex gap-1 z-50">
      <>
        <button
          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
        >
          <Pause className="h-4"/>
        </button>

        <button
          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
        >
          <Camera className="h-4"/>
        </button>

        <button
          title="Show/Hide FPS"
          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
        >
          <Shuffle className="h-4"/>
        </button>

        <button
          title="Show/Hide FPS"
          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
        >
          <ToggleLeft className="h-4"/>
        </button>
      </>
    </div>
  );
}