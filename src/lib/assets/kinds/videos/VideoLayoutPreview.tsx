"use client";
import {
  useRef, useState
} from "react";

import type {
  AssetLayoutPreviewProps
} from "../../types";
import {
  computeVideoLayout, type VideoParams
} from "./types";

/**
 * Preview that shows *where* and *how big* the video lands on the final
 * canvas. The outer box mirrors the canvas aspect ratio; the `<video>` is
 * positioned inside it using the exact same {@link computeVideoLayout} the
 * sketch uses at render time, expressed in percentages of the box.
 *
 * This is deliberately a representative container — not a real p5 canvas —
 * so changing the scale / position / aspect-ratio params gives immediate,
 * cheap visual feedback. No rounded corners: the canvas has none either.
 */
export default function VideoLayoutPreview( {
  url,
  path,
  params,
  canvasAspectRatio = 1
}: AssetLayoutPreviewProps<VideoParams> ) {
  const videoRef = useRef<HTMLVideoElement>( null );
  const [
    natural,
    setNatural
  ] = useState( {
    width: 0,
    height: 0
  } );

  const ratio = canvasAspectRatio && canvasAspectRatio > 0 ? canvasAspectRatio : 1;

  // Lay the frame out within a normalized 100×100 box, then express the
  // result as percentages so it scales with whatever size the box renders at.
  const layout = computeVideoLayout(
    params,
    {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    },
    natural
  );

  return (
    <div
      className="relative mx-auto overflow-hidden border border-theme bg-foreground/[0.06]"
      // Cap the width at `height-cap × ratio` so the box always fits the pane
      // for any orientation (portrait reels, square, landscape) while keeping
      // the exact canvas aspect ratio — no JS measuring, pure CSS.
      style={ {
        aspectRatio: ratio,
        width: `min(100%, calc(70vh * ${ ratio }))`
      } }
    >
      {url ? (
        <video
          ref={ videoRef }
          src={ url }
          title={ path }
          muted
          loop
          autoPlay
          playsInline
          onLoadedMetadata={ () => {
            const el = videoRef.current;

            if ( el?.videoWidth && el.videoHeight ) {
              setNatural( {
                width: el.videoWidth,
                height: el.videoHeight
              } );
            }
          } }
          className="absolute bg-black"
          style={ {
            left: `${ layout.x }%`,
            top: `${ layout.y }%`,
            width: `${ layout.width }%`,
            height: `${ layout.height }%`,
            objectFit: "fill"
          } }
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-xs text-gray-400">
          No video
        </div>
      )}
    </div>
  );
}
