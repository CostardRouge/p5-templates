"use client";

import React, {
  ReactNode, useCallback, useEffect, useRef
} from "react";
import {
  createPortal
} from "react-dom";
import ZoomControls from "@/components/ScalableViewport/components/ZoomControls";
import type {
  FullscreenControls
} from "@/components/ScalableViewport/components/ZoomControls";
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
  lockInteractions = false,
  docked = false,
  zoomControlsContainer = null,
  fullscreen,
  actualPixels = false,
  fitMarginFactor,
  onInteractionStart,
  onInteractionEnd
}: {
  children: ReactNode;
  initialScale?: number;
  resolutionKey?: string;
  showZoomControls?: boolean;
  disable?: boolean;
  // Fullscreen options in the zoom controls — owned by the page, which holds
  // the fullscreen state and the element that goes fullscreen.
  fullscreen?: FullscreenControls;
  // Auto-layout at 1:1 (actual pixels) instead of the padded fit — used in bare
  // fullscreen so a screen-sized canvas fills the display exactly.
  actualPixels?: boolean;
  // Fraction of the viewport a "fit" fills. Defaults to the studio's padded
  // 0.9; pass 1 for a flush, gutter-free fit (embeds without a margin).
  fitMarginFactor?: number;
  // In the docked workspace layout the zoom controls render flat and portal
  // into the top bar (`zoomControlsContainer`) instead of floating top-right.
  docked?: boolean;
  zoomControlsContainer?: HTMLElement | null;
  // Ignore touchscreen pan/pinch so fingers reach the content instead of
  // moving the viewport (mouse drag, wheel and zoom controls still work).
  disableTouchGestures?: boolean;
  // Freeze all pan/zoom (gestures + zoom controls) while keeping the
  // current transform on screen — used during a browser recording so the
  // viewport can't disturb the in-flight capture.
  lockInteractions?: boolean;
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
    lockInteractions,
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
      animateTo,
      fitMarginFactor
    } );

  // Auto-layout used by the resize/resolution observers below. Bare fullscreen
  // wants a true 1:1 (actual pixels) fill; everything else uses the padded fit.
  const applyAutoLayout = useCallback(
    ( animate: boolean ) =>
      ( actualPixels ? resetToActualPixels : fitToViewport )( animate ),
    [
      actualPixels,
      resetToActualPixels,
      fitToViewport
    ]
  );

  // Lay out when resolution changes or when ready
  useEffect(
    () => {
      if ( !isReady || !contentRef.current ) {
        return;
      }

      // Use requestAnimationFrame to ensure the canvas has been resized
      // before we calculate the layout. This handles the case where the
      // resolution changes but the DOM hasn't updated yet.
      const rafId = requestAnimationFrame( () => {
        // Double RAF to ensure layout has been calculated
        requestAnimationFrame( () => {
          applyAutoLayout( false );
        } );
      } );

      return () => cancelAnimationFrame( rafId );
    },
    [
      resolutionKey,
      isReady,
      applyAutoLayout
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
          // Only re-layout if the content size actually changed
          if ( entry.contentBoxSize && entry.contentBoxSize.length > 0 ) {
            // Use requestAnimationFrame to batch the re-layout
            requestAnimationFrame( () => {
              applyAutoLayout( false );
            } );
          }
        }
      } );

      observer.observe( contentRef.current );

      return () => observer.disconnect();
    },
    [
      isReady,
      applyAutoLayout
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
          applyAutoLayout( false );
        } );
      } );

      observer.observe( containerRef.current );

      return () => observer.disconnect();
    },
    [
      isReady,
      applyAutoLayout
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

  const zoomControls = showZoomControls ? (
    <ZoomControls
      scale={ displayScale }
      onPlus={ zoomIn }
      onMinus={ zoomOut }
      onFit={ () => fitToViewport( true ) }
      onReset={ () => resetToActualPixels( true ) }
      fullscreen={ fullscreen }
      disabled={ lockInteractions }
      variant={ docked ? "bar" : "floating" }
    />
  ) : null;

  return (
    <>
      {/* Floating: outside the overflow-hidden container so the controls can
          sit in the top strip the page reserves for the floating bars on
          mobile — they position against the page wrapper, whose origin stays
          at the top of the screen regardless of that padding. Docked: portal
          the flat controls into the top bar; render nothing until its slot
          exists so the floating island never flashes first. */}
      {docked
        ? zoomControls && zoomControlsContainer
          ? createPortal(
            zoomControls,
            zoomControlsContainer
          )
          : null
        : zoomControls}

      <div
        ref={ containerRef }
        className={ `w-full h-full overflow-hidden touch-none relative ${ lockInteractions ? "cursor-default" : "cursor-grab active:cursor-grabbing" }` }
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
