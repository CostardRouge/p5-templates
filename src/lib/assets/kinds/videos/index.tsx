"use client";
import {
  useRef
} from "react";

import type {
  AssetInstance, AssetKind, AssetPreviewProps
} from "../../types";
import VideoLayoutPreview from "./VideoLayoutPreview";
import VideoParamsEditor from "./VideoParamsEditor";
import {
  defaultVideoParams, type VideoParams
} from "./types";

function VideoPreview( {
  url, path
}: AssetPreviewProps ) {
  const ref = useRef<HTMLVideoElement>( null );

  if ( !url ) {
    return (
      <div className="h-full w-full grid place-items-center text-xs text-gray-400 bg-gray-50">
        Invalid video
      </div>
    );
  }

  return (
    <video
      ref={ ref }
      src={ url }
      muted
      playsInline
      preload="metadata"
      className="object-cover h-full w-full bg-black"
      title={ path }
      // Force a first-frame paint as soon as metadata is available.
      // Without this nudge, some browsers (Chrome especially) leave the
      // video element rendering its black background until the user
      // interacts with it — which made existing thumbnails appear to
      // "vanish" when a sibling tile was added and the grid re-rendered.
      onLoadedMetadata={ () => {
        const el = ref.current;

        if ( el && el.currentTime === 0 ) {
          try {
            el.currentTime = 0.001;
          } catch {
            /* noop */
          }
        }
      } }
      onMouseEnter={ () => ref.current?.play().catch( () => {} ) }
      onMouseLeave={ () => {
        const el = ref.current;

        if ( el ) {
          el.pause();
          el.currentTime = 0.001;
        }
      } }
    />
  );
}

export const videosKind: AssetKind<VideoParams> = {
  id: "videos",
  label: "Video",
  accept: "video/*",
  hasParams: true,
  defaultParams: () => ( {
    ...defaultVideoParams
  } ),

  parseFieldEntry(
    raw, makeId
  ): AssetInstance<VideoParams> {
    if ( typeof raw === "string" ) {
      return {
        id: makeId(),
        path: raw,
        params: {
          ...defaultVideoParams
        }
      };
    }

    const obj = raw as Partial<AssetInstance<Partial<VideoParams>>>;

    return {
      id: obj.id ?? makeId(),
      path: obj.path ?? "",
      params: {
        ...defaultVideoParams,
        ...( obj.params ?? {} )
      }
    };
  },

  serializeFieldEntry( instance ): AssetInstance<VideoParams> {
    return instance;
  },

  PreviewComponent: VideoPreview,
  LayoutPreviewComponent: VideoLayoutPreview,
  ParamsEditor: VideoParamsEditor
};
