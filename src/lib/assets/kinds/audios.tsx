"use client";
import React, {
  useRef, useState
} from "react";
import {
  AudioLines, Pause, Play
} from "lucide-react";

import type {
  AssetInstance, AssetKind, AssetPreviewProps
} from "../types";

type AudioParams = Record<string, never>;

/**
 * Sound files have no thumbnail, so the tile is the affordance: the file name
 * plus a play/pause button that auditions the sample right in the form. The
 * button stops its click from bubbling — the enclosing picker opens the file
 * dialog on click, and auditioning must not re-open it.
 */
function AudioPreview( {
  url, path, className, children
}: AssetPreviewProps ) {
  const ref = useRef<HTMLAudioElement>( null );
  const [
    playing,
    setPlaying
  ] = useState( false );

  if ( !url ) {
    return (
      <div className="h-full w-full grid place-items-center text-xs text-gray-400 bg-gray-50">
        Invalid audio
      </div>
    );
  }

  const toggle = ( event: React.MouseEvent ) => {
    event.stopPropagation();
    event.preventDefault();

    const element = ref.current;

    if ( !element ) {
      return;
    }

    if ( element.paused ) {
      element.currentTime = 0;
      element.play().catch( () => setPlaying( false ) );
    } else {
      element.pause();
    }
  };

  return (
    <div className={ `relative h-full w-full bg-black/80 ${ className ?? "" }` }>
      <audio
        ref={ ref }
        src={ url }
        preload="metadata"
        onPlay={ () => setPlaying( true ) }
        onPause={ () => setPlaying( false ) }
        onEnded={ () => setPlaying( false ) }
        // A re-upload swaps the src under a mounted element: the browser
        // empties the media, so reset the button from that event rather than
        // from an effect watching the url.
        onEmptied={ () => setPlaying( false ) }
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 text-white">
        <button
          type="button"
          onClick={ toggle }
          title={ playing ? "Pause" : "Play" }
          className="grid h-7 w-7 place-items-center rounded-full border border-white/40 bg-white/10 hover:bg-white/25"
        >
          {playing
            ? <Pause className="h-3.5 w-3.5" />
            : <Play className="h-3.5 w-3.5 translate-x-px" />}
        </button>

        <span className="flex w-full items-center justify-center gap-1 truncate text-[10px] text-white/70">
          <AudioLines className="h-3 w-3 shrink-0" />
          <span className="truncate">{path.split( "/" ).pop()}</span>
        </span>
      </div>

      {children}
    </div>
  );
}

export const audiosKind: AssetKind<AudioParams> = {
  id: "audios",
  label: "Audio",
  accept: "audio/*",
  hasParams: false,
  defaultParams: () => ( {} ),

  parseFieldEntry(
    raw, makeId
  ): AssetInstance<AudioParams> {
    if ( typeof raw === "string" ) {
      return {
        id: makeId(),
        path: raw,
        params: {}
      };
    }

    const obj = raw as Partial<AssetInstance<AudioParams>>;

    return {
      id: obj.id ?? makeId(),
      path: obj.path ?? "",
      params: {}
    };
  },

  // Path-only, like images: sketches read `o.sound.down` as a plain path and
  // hand it straight to `audioAssets.play()`.
  serializeFieldEntry( instance ): string {
    return instance.path;
  },

  PreviewComponent: AudioPreview
};
