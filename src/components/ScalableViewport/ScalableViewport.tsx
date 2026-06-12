"use client";

import React, {
  ReactNode, useCallback, useEffect, useRef
} from "react";
import ZoomControls from "@/components/ScalableViewport/components/ZoomControls";
import {
  useTransformState
} from "./hooks/useTransformState";
import {
  useViewportAnimation
} from "./hooks/useViewportAnimation";
import {
  useViewportGestures
} from "./hooks/useViewportGestures";
import {
  useViewportActions
} from "./hooks/useViewportActions";

export default function ScalableViewport( {
  children,
  initialScale,
  showZoomControls = true,
  resolutionKey,
  isReady = true,
  disable = false,
  disableTouchGestures = false,
  onInteractionStart,
  onInteractionEnd
}: {
  children: ReactNode;
  initialScale?: number;
  resolutionKey?: string;
  showZoomControls?: boolean;
  disable?: boolean;
  // Ignore touchscreen pan/pinch so fingers reach the content instead of
  // moving the viewport (mouse drag, wheel and zoom controls still work).
  disableTouchGestures?: boolean;
  isReady?: boolean;
  onInteractionStart?: ( mode: "panning" | "zooming" ) => void;
  onInteractionEnd?: () => void;
} ) {
  const containerRef = useRef<HTMLDivElement | null>( null );
  const contentRef = useRef<HTMLDivElement | null>( null );

  const {
    transform, displayScale, setTransform
  } = useTransformState( initialScale || 1 );

  const handleAnimationStart = useCallback(
    () => onInteractionStart?.( "zooming" ),
    [
      onInteractionStart
    ]
  );

  const {
    animateTo, cancelAnimation
  } = useViewportAnimation(
    setTransform,
    transform,
    contentRef,
    handleAnimationStart,
    onInteractionEnd
  );

  useViewportGestures( {
    containerRef,
    contentRef,
    transform,
    setTransform,
    cancelAnimation,
    disableTouchGestures,
    onInteractionStart,
    onInteractionEnd
  } );

  const {
    fitToViewport, resetToActualPixels, zoomIn, zoomOut
  } =
    useViewportActions( {
      containerRef,
      contentRef,
      transform,
      setTransform,
      animateTo
    } );

  // Fit to viewport when resolution changes or when ready
  useEffect(
    () => {
      if ( !isReady || !contentRef.current ) {
        return;
      }

      // Use requestAnimationFrame to ensure the canvas has been resized
      // before we calculate the fit. This handles the case where the
      // resolution changes but the DOM hasn't updated yet.
      const rafId = requestAnimationFrame( () => {
        // Double RAF to ensure layout has been calculated
        requestAnimationFrame( () => {
          fitToViewport( false );
        } );
      } );

      return () => cancelAnimationFrame( rafId );
    },
    [
      resolutionKey,
      isReady,
      fitToViewport
    ]
  );

  // Observe content size changes and refit when canvas dimensions change
  useEffect(
    () => {
      if ( !contentRef.current || !isReady ) {
        return;
      }

      const observer = new ResizeObserver( ( entries ) => {
        for ( const entry of entries ) {
          // Only refit if the content size actually changed
          if ( entry.contentBoxSize && entry.contentBoxSize.length > 0 ) {
            // Use requestAnimationFrame to batch the refit
            requestAnimationFrame( () => {
              fitToViewport( false );
            } );
          }
        }
      } );

      observer.observe( contentRef.current );

      return () => observer.disconnect();
    },
    [
      isReady,
      fitToViewport
    ]
  );

  // Observe container size changes (viewport resize)
  useEffect(
    () => {
      if ( !containerRef.current || !isReady ) {
        return;
      }

      const observer = new ResizeObserver( () => {
        requestAnimationFrame( () => {
          fitToViewport( false );
        } );
      } );

      observer.observe( containerRef.current );

      return () => observer.disconnect();
    },
    [
      isReady,
      fitToViewport
    ]
  );

  if ( disable ) {
    return (
      <div
        ref={ contentRef }
        className="origin-top-left absolute top-0 left-0 will-change-transform"
      >
        {children}
      </div>
    );
  }

  return (
    <>
      {/* Outside the overflow-hidden container so the controls can sit in
          the top strip the page reserves for the floating bars on mobile —
          they position against the page wrapper, whose origin stays at the
          top of the screen regardless of that padding. */}
      {showZoomControls && (
        <ZoomControls
          scale={ displayScale }
          onPlus={ zoomIn }
          onMinus={ zoomOut }
          onFit={ () => fitToViewport( true ) }
          onReset={ () => resetToActualPixels( true ) }
        />
      )}

      <div
        ref={ containerRef }
        className="w-full h-full overflow-hidden touch-none relative cursor-grab active:cursor-grabbing"
        style={ {
          touchAction: "none"
        } }
      >
        <div
          ref={ contentRef }
          className="origin-top-left absolute top-0 left-0 will-change-transform"
        >
          {children}
        </div>
      </div>
    </>
  );
}
