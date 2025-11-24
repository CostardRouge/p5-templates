"use client";

import React, {
  ReactNode, useEffect, useRef
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
}: {
  children: ReactNode;
  initialScale?: number;
  resolutionKey?: string;
  showZoomControls?: boolean;
  isReady?: boolean;
} ) {
  const containerRef = useRef<HTMLDivElement | null>( null );
  const contentRef = useRef<HTMLDivElement | null>( null );

  const {
    transform, setTransform
  } = useTransformState( initialScale || 1 );

  const {
    animateTo, cancelAnimation
  } = useViewportAnimation(
    setTransform,
    transform,
    contentRef
  );

  useViewportGestures( {
    containerRef,
    contentRef,
    transform,
    setTransform,
    cancelAnimation,
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
    } );

  useEffect(
    () => {
      if ( !isReady ) return;
      const timer = setTimeout(
        () => {
          fitToViewport( false );
        },
        100
      );

      return () => clearTimeout( timer );
    },
    [
      resolutionKey,
      isReady,
      fitToViewport
    ]
  );

  useEffect(
    () => {
      if ( !containerRef.current ) return;
      const observer = new ResizeObserver( () => {} );

      observer.observe( containerRef.current );
      return () => observer.disconnect();
    },
    [
    ]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden touch-none relative cursor-grab active:cursor-grabbing"
      style={{
        touchAction: "none"
      }}
    >
      {showZoomControls && (
        <ZoomControls
          onPlus={zoomIn}
          onMinus={zoomOut}
          onFit={() => fitToViewport( true )}
          onReset={() => resetToActualPixels( true )}
        />
      )}

      <div
        ref={contentRef}
        className="origin-top-left absolute top-0 left-0 will-change-transform"
      >
        {children}
      </div>
    </div>
  );
}
