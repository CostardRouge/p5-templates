"use client";

import {
  useEffect, useRef, useState
} from "react";
import usePageVisibility from "@/hooks/usePageVisibility";

interface AnimatedPreviewProps {
  previewUrl: string;
  thumbnailUrl: string;
  name: string;
  imgClassName?: string;
  eager?: boolean;
}

// Read once at module level — safe in both browser and SSR (defaults to false on server)
const TRIGGER_ON_HOVER =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_PREVIEW_ON_HOVER === "true";

/**
 * Renders a static thumbnail with an animated WebM overlay.
 *
 * Playback is triggered either by the element entering the viewport
 * (default) or by hover when NEXT_PUBLIC_PREVIEW_ON_HOVER=true.
 *
 * Respects prefers-reduced-motion: shows the static thumbnail only.
 * Pauses video playback when the tab is hidden to save CPU/GPU/battery.
 */
export default function AnimatedPreview( {
  previewUrl,
  thumbnailUrl,
  name,
  imgClassName = "",
  eager = false
}: AnimatedPreviewProps ) {
  const containerRef = useRef<HTMLDivElement>( null );
  const videoRef = useRef<HTMLVideoElement>( null );
  const prefersReducedRef = useRef( false );
  const [
    wantsToPlay,
    setWantsToPlay
  ] = useState( false );
  const [
    isPlaying,
    setIsPlaying
  ] = useState( false );
  const isPageVisible = usePageVisibility();

  // Track prefers-reduced-motion without causing re-render on each frame
  useEffect(
    () => {
      const mq = window.matchMedia( "(prefers-reduced-motion: reduce)" );

      prefersReducedRef.current = mq.matches;

      const handler = ( e: MediaQueryListEvent ) => {
        prefersReducedRef.current = e.matches;

        if ( e.matches ) {
          stopVideo();
        }
      };

      mq.addEventListener(
        "change",
        handler
      );
      return () => mq.removeEventListener(
        "change",
        handler
      );
    },
    []
  );

  function playVideo() {
    const video = videoRef.current;

    if ( !video || prefersReducedRef.current ) {
      return;
    }

    if ( !video.src ) {
      video.src = previewUrl;
    }

    video.play().catch( () => {} );
    setIsPlaying( true );
  }

  function stopVideo() {
    const video = videoRef.current;

    if ( !video ) {
      return;
    }
    video.pause();
    setIsPlaying( false );
  }

  // Viewport-based intent (default mode)
  useEffect(
    () => {
      if ( TRIGGER_ON_HOVER || !containerRef.current ) {
        return;
      }

      const el = containerRef.current;

      const observer = new IntersectionObserver(
        ( entries ) => {
          for ( const entry of entries ) {
            setWantsToPlay( entry.isIntersecting );
          }
        },
        {
          threshold: 0.4
        }
      );

      observer.observe( el );
      return () => observer.disconnect();
    },
    []
  );

  // Combine intent (viewport/hover) with permission (tab visibility).
  // The video only plays when the user can actually see it.
  useEffect(
    () => {
      if ( wantsToPlay && isPageVisible ) {
        playVideo();
      } else {
        stopVideo();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      wantsToPlay,
      isPageVisible
    ]
  );

  const hoverHandlers = TRIGGER_ON_HOVER
    ? {
      onMouseEnter: () => setWantsToPlay( true ),
      onMouseLeave: () => setWantsToPlay( false )
    }
    : {};

  // Mirror the caller's object-fit choice on the <video> so the playing
  // preview fills (or letterboxes) the container the same way the
  // thumbnail does. Without this, callers that pass `object-cover` would
  // see the thumbnail bleed around the contained video.
  const objectFitMatch = imgClassName.match( /object-(cover|contain|fill|none|scale-down)/ );
  const objectFitClass = objectFitMatch ? objectFitMatch[ 0 ] : "object-contain";

  return (
    <div
      ref={ containerRef }
      className="absolute top-0 left-0 w-full h-full"
      { ...hoverHandlers }
    >
      <img
        alt={ name }
        src={ thumbnailUrl }
        srcSet={ `${ thumbnailUrl } 1x, ${ thumbnailUrl.replace(
          /\.webp$/,
          "-2x.webp"
        ) } 2x` }
        width={ 360 }
        height={ 450 }
        loading={ eager ? "eager" : "lazy" }
        fetchPriority={ eager ? "high" : undefined }
        decoding={ eager ? "sync" : "async" }
        className={ imgClassName }
      />
      <video
        ref={ videoRef }
        muted
        loop
        playsInline
        preload="none"
        className={ `absolute top-0 left-0 w-full h-full ${ objectFitClass } transition-opacity duration-500 pointer-events-none ${
          isPlaying ? "opacity-100" : "opacity-0"
        }` }
      />
    </div>
  );
}
