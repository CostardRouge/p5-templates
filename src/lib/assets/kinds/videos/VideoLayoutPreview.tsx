"use client";
import {
  useEffect, useRef, useState, type PointerEvent as ReactPointerEvent
} from "react";

import type {
  AssetLayoutPreviewProps
} from "../../types";
import {
  computeVideoLayout, computeVideoPhase, type VideoParams
} from "./types";

/**
 * Preview that shows *where*, *how big*, and *how* the video plays on the
 * final canvas. The outer box mirrors the canvas aspect ratio; the `<video>`
 * is positioned inside it using the exact same {@link computeVideoLayout} the
 * sketch uses at render time, expressed in percentages of the box.
 *
 * The video is not left to play on its own — its `currentTime` is driven each
 * frame through {@link computeVideoPhase}, sweeping the sketch progression
 * `p` ∈ [0, 1] over a fixed cycle. That makes the repeat / speed / offset /
 * loop-mode params visible at a glance, mirroring the mini timeline curve.
 *
 * This is deliberately a representative container — not a real p5 canvas — so
 * editing any param gives immediate, cheap visual feedback. No rounded
 * corners: the canvas has none either.
 *
 * When an `onParamsChange` is supplied the thumbnail is draggable: grabbing it
 * sets `posX` / `posY` directly, staying perfectly in sync with the position
 * sliders since both write the same instance params.
 */

// One full sketch progression takes this long in the preview. Fixed (rather
// than the clip's own duration) so the loop stays lively for both very short
// and very long clips while still showing the param relationships.
const PREVIEW_CYCLE_SECONDS = 4;

const clampOffset = ( value: number ) => Math.min(
  1,
  Math.max(
    -1,
    value
  )
);

export default function VideoLayoutPreview( {
  url,
  path,
  params,
  canvasAspectRatio = 1,
  onParamsChange
}: AssetLayoutPreviewProps<VideoParams> ) {
  const videoRef = useRef<HTMLVideoElement>( null );
  // The canvas-ratio box the video is positioned within; measured in pixels at
  // drag time to translate a pointer delta into `posX` / `posY` (which are
  // fractions of the box, matching the sketch's `posX * box.width` offset).
  const boxRef = useRef<HTMLDivElement>( null );
  // Snapshot taken on pointer-down: the pointer origin plus the position at
  // that instant, so each move applies an absolute delta (immune to the
  // re-renders our own onParamsChange triggers).
  const dragOriginRef = useRef<{
    x: number;
    y: number;
    posX: number;
    posY: number;
  } | null>( null );
  const [
    dragging,
    setDragging
  ] = useState( false );

  const interactive = Boolean( onParamsChange );
  // A free-running clock that survives param edits, so changing scale or
  // position never resets the playback progression.
  const startRef = useRef<number | null>( null );
  const [
    natural,
    setNatural
  ] = useState( {
    width: 0,
    height: 0
  } );

  const {
    repeat, speed, offset, loopMode
  } = params;

  // Drive currentTime from the progression→phase mapping so repeat/speed/
  // offset/loopMode are reflected live. Only the phase-relevant params are
  // dependencies — layout-only edits read straight from render and never
  // disturb the clock.
  useEffect(
    () => {
      const el = videoRef.current;

      if ( !el || !url ) {
        return;
      }

      let raf = 0;

      const tick = ( now: number ) => {
        const duration = el.duration;

        if ( Number.isFinite( duration ) && duration > 0 ) {
          if ( startRef.current === null ) {
            startRef.current = now;
          }

          const p =
            ( ( now - startRef.current ) / 1000 % PREVIEW_CYCLE_SECONDS ) /
            PREVIEW_CYCLE_SECONDS;
          const phase = computeVideoPhase(
            p,
            {
              repeat,
              speed,
              offset,
              loopMode
            } as VideoParams
          );
          const target = Math.min(
            duration - 1e-3,
            Math.max(
              0,
              phase * duration
            )
          );

          // Skip sub-frame nudges to avoid thrashing the decoder.
          if ( Math.abs( target - el.currentTime ) > 1e-3 ) {
            try {
              el.currentTime = target;
            } catch {
              /* seek not ready yet — retry next frame */
            }
          }
        }

        raf = requestAnimationFrame( tick );
      };

      raf = requestAnimationFrame( tick );

      return () => cancelAnimationFrame( raf );
    },
    [
      url,
      repeat,
      speed,
      offset,
      loopMode
    ]
  );

  // Drag-to-position: grab the video thumbnail and slide it inside the box.
  // A pointer delta in pixels maps directly to a `posX` / `posY` delta because
  // the box's full pixel width/height represents one unit of the offset (the
  // sketch nudges by `posX * box.width` / `posY * box.height`). Clamped to the
  // same [-1, 1] range as the position sliders so the two stay interchangeable.
  const handlePointerDown = ( event: ReactPointerEvent<HTMLVideoElement> ) => {
    if ( !onParamsChange ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture( event.pointerId );
    dragOriginRef.current = {
      x: event.clientX,
      y: event.clientY,
      posX: params.posX,
      posY: params.posY
    };
    setDragging( true );
  };

  const handlePointerMove = ( event: ReactPointerEvent<HTMLVideoElement> ) => {
    const origin = dragOriginRef.current;
    const box = boxRef.current;

    if ( !origin || !box || !onParamsChange ) {
      return;
    }

    const rect = box.getBoundingClientRect();

    if ( rect.width === 0 || rect.height === 0 ) {
      return;
    }

    onParamsChange( {
      ...params,
      posX: clampOffset( origin.posX + ( event.clientX - origin.x ) / rect.width ),
      posY: clampOffset( origin.posY + ( event.clientY - origin.y ) / rect.height )
    } );
  };

  const endDrag = ( event: ReactPointerEvent<HTMLVideoElement> ) => {
    if ( !dragOriginRef.current ) {
      return;
    }

    dragOriginRef.current = null;
    setDragging( false );

    if ( event.currentTarget.hasPointerCapture( event.pointerId ) ) {
      event.currentTarget.releasePointerCapture( event.pointerId );
    }
  };

  const ratio = canvasAspectRatio && canvasAspectRatio > 0 ? canvasAspectRatio : 1;

  // Lay the frame out in a box that has the *real* canvas aspect ratio — not a
  // square — exactly like the sketch passes the real cell pixel size. Feeding
  // a square box here made `contain`/`cover` preserve the wrong ratio, so the
  // video got stretched by the canvas ratio. Each axis is then converted to a
  // percentage of its own box dimension so it lands right in the CSS box.
  const box = {
    x: 0,
    y: 0,
    width: ratio,
    height: 1
  };
  const layout = computeVideoLayout(
    params,
    box,
    natural
  );

  return (
    <div
      ref={ boxRef }
      // `--cap` is the most height the box may take; it shrinks on small
      // screens so the preview never crowds out the scrollable settings.
      className="relative mx-auto overflow-hidden border border-theme bg-foreground/[0.06] [--cap:34vh] sm:[--cap:48vh] md:[--cap:72vh]"
      // Cap the width at `cap × ratio` so the box always fits for any
      // orientation (portrait reels, square, landscape) while keeping the
      // exact canvas aspect ratio — pure CSS, no JS measuring.
      style={ {
        aspectRatio: ratio,
        width: `min(100%, calc(var(--cap) * ${ ratio }))`
      } }
    >
      {url ? (
        <video
          ref={ videoRef }
          src={ url }
          muted
          playsInline
          draggable={ false }
          onLoadedMetadata={ () => {
            const el = videoRef.current;

            if ( el?.videoWidth && el.videoHeight ) {
              setNatural( {
                width: el.videoWidth,
                height: el.videoHeight
              } );
            }
          } }
          onPointerDown={ interactive ? handlePointerDown : undefined }
          onPointerMove={ interactive ? handlePointerMove : undefined }
          onPointerUp={ interactive ? endDrag : undefined }
          onPointerCancel={ interactive ? endDrag : undefined }
          title={ interactive ? "Drag to reposition" : path }
          className="absolute bg-black"
          style={ {
            left: `${ ( layout.x / box.width ) * 100 }%`,
            top: `${ ( layout.y / box.height ) * 100 }%`,
            width: `${ ( layout.width / box.width ) * 100 }%`,
            height: `${ ( layout.height / box.height ) * 100 }%`,
            objectFit: "fill",
            cursor: interactive ? ( dragging ? "grabbing" : "grab" ) : "default",
            touchAction: interactive ? "none" : undefined,
            userSelect: "none"
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
