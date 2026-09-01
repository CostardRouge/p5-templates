"use client";

import {
  useEffect, useRef, useState
} from "react";
import usePageVisibility from "@/hooks/usePageVisibility";

interface AnimatedPreviewProps {
  previewUrl: string;
  // Higher-res variant to use at the `md` breakpoint and above. When omitted,
  // `previewUrl` is used at all sizes.
  previewUrlDesktop?: string;
  thumbnailUrl: string;
  name: string;
  /**
   * Alt text for the still. Defaults to `name`, but a card that already prints
   * the sketch's name next to the picture should pass `""`: the image is
   * decorative there, and repeating the name makes a screen reader say it
   * twice for one link (axe `image-redundant-alt`).
   */
  alt?: string;
  imgClassName?: string;
  eager?: boolean;
  // When defined, overrides the OS `prefers-reduced-motion` setting:
  // `true` forces playback to be allowed, `false` keeps the static thumbnail.
  animationsEnabled?: boolean;
}

// Read once at module level — safe in both browser and SSR (defaults to false on server)
const TRIGGER_ON_HOVER =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_PREVIEW_ON_HOVER === "true";

// Matches Tailwind's `md:` — the breakpoint at which the home page layout
// switches to multi-column, making the higher-res preview worthwhile.
const DESKTOP_PREVIEW_QUERY = "(min-width: 768px)";

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
  previewUrlDesktop,
  thumbnailUrl,
  name,
  alt,
  imgClassName = "",
  eager = false,
  animationsEnabled
}: AnimatedPreviewProps ) {
  const containerRef = useRef<HTMLDivElement>( null );
  const videoRef = useRef<HTMLVideoElement>( null );
  const prefersReducedRef = useRef( false );
  const animationsEnabledRef = useRef( animationsEnabled );
  const [
    wantsToPlay,
    setWantsToPlay
  ] = useState( false );
  const [
    isPlaying,
    setIsPlaying
  ] = useState( false );
  // Mobile-first: start with the baseline URL so SSR + client hydration match.
  // If a desktop variant is provided, swap to it after mount when the breakpoint matches.
  const [
    effectivePreviewUrl,
    setEffectivePreviewUrl
  ] = useState( previewUrl );
  const isPageVisible = usePageVisibility();

  useEffect(
    () => {
      if ( !previewUrlDesktop ) {
        setEffectivePreviewUrl( previewUrl );
        return;
      }

      const mq = window.matchMedia( DESKTOP_PREVIEW_QUERY );
      const pick = () => setEffectivePreviewUrl( mq.matches ? previewUrlDesktop : previewUrl );

      pick();
      mq.addEventListener(
        "change",
        pick
      );
      return () => mq.removeEventListener(
        "change",
        pick
      );
    },
    [
      previewUrl,
      previewUrlDesktop
    ]
  );

  // If the chosen URL changes after we've already loaded one, swap the
  // underlying <video> source so the next play picks it up.
  useEffect(
    () => {
      const video = videoRef.current;

      if ( !video || !video.src ) {
        return;
      }

      if ( video.src.endsWith( effectivePreviewUrl ) ) {
        return;
      }

      const wasPlaying = !video.paused;

      video.src = effectivePreviewUrl;

      if ( wasPlaying ) {
        video.play().catch( () => {} );
      }
    },
    [
      effectivePreviewUrl
    ]
  );

  // Track prefers-reduced-motion without causing re-render on each frame
  useEffect(
    () => {
      const mq = window.matchMedia( "(prefers-reduced-motion: reduce)" );

      prefersReducedRef.current = mq.matches;

      const handler = ( e: MediaQueryListEvent ) => {
        prefersReducedRef.current = e.matches;

        // Only honour OS changes when the parent hasn't opted-in explicitly.
        if ( e.matches && animationsEnabledRef.current !== true ) {
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

  // Stop or resume when the parent toggles animations on/off.
  useEffect(
    () => {
      animationsEnabledRef.current = animationsEnabled;

      if ( animationsEnabled === false ) {
        stopVideo();
      } else if ( animationsEnabled === true && wantsToPlay && isPageVisible ) {
        playVideo();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      animationsEnabled
    ]
  );

  function playVideo() {
    const video = videoRef.current;

    if ( !video ) {
      return;
    }

    // Explicit override from the parent wins over the OS preference.
    if ( animationsEnabledRef.current === false ) {
      return;
    }

    if ( animationsEnabledRef.current !== true && prefersReducedRef.current ) {
      return;
    }

    if ( !video.src ) {
      video.src = effectivePreviewUrl;
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
        data-pin-nopin="true"
        alt={ alt ?? name }
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
