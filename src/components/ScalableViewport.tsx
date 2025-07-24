"use client";

import React, {
  ReactNode, useCallback,
  useEffect, useRef, useState
} from "react";

import clamp from "@/utils/clamp";
import ZoomControls from "@/components/ZoomControls";
/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const MIN_SCALE = 0.1;
const MAX_SCALE = 6;

export default function ScalableViewport( {
  children,
}: {
  children: ReactNode;
} ) {
  /* ---------------------------------------------------------------- */
  /*  Zoom / viewport state                                           */
  /* ---------------------------------------------------------------- */
  const viewportRef = useRef<HTMLDivElement | null>( null );
  const canvasRef = useRef<HTMLDivElement | null>( null );
  const [
    scale,
    setScale
  ] = useState<number>( 1 );

  /* ---------------------------------------------------------------- */
  /*  Utility functions                                               */
  /* ---------------------------------------------------------------- */
  const applyScale = ( newScale: number ) => {
    const canvas = canvasRef.current;

    if ( !canvas ) {
      return;
    }

    canvas.style.transform = `scale(${ newScale })`;
    setScale( newScale );
  };

  const fitToViewport = useCallback(
    () => {
      const viewport = viewportRef.current;

      if ( !viewport ) {
        return;
      }

      const canvas = canvasRef.current;

      if ( !canvas ) {
        return;
      }

      const widthRatio = viewport.clientWidth / canvas.clientWidth;
      const heightRatio = viewport.clientHeight / canvas.clientHeight;

      const bestFitScale = Math.min(
        widthRatio,
        heightRatio
      );

      applyScale( clamp(
        bestFitScale,
        MIN_SCALE,
        MAX_SCALE
      ) / 1.2 );
    },
    [

    ]
  );

  const resetToActualPixels = () => {
    applyScale( 1 );
  };

  /* ---------------------------------------------------------------- */
  /*  Keyboard + mouse wheel zoom (desktop)                           */
  /* ---------------------------------------------------------------- */
  useEffect(
    () => {
      const viewport = viewportRef.current;

      if ( !viewport ) {
        return;
      }

      const handleWheel = ( event: WheelEvent ) => {
        if ( ( event.target as HTMLElement ).closest( "[data-no-zoom]" ) ) {
          return;
        }

        // if ( !event.ctrlKey ) {
        //   return;
        // } // require Ctrl / Cmd like design tools

        event.preventDefault();

        const deltaScale = event.deltaY < 0 ? 0.1 : -0.1;

        applyScale( clamp(
          scale + deltaScale,
          MIN_SCALE,
          MAX_SCALE
        ) );
      };

      viewport.addEventListener(
        "wheel",
        handleWheel,
        {
          passive: false
        }
      );
      return () => viewport.removeEventListener(
        "wheel",
        handleWheel
      );
    },
    [
      scale
    ]
  );

  /* ---------------------------------------------------------------- */
  /*  Touch pinch zoom (mobile/tablet)                                */
  /* ---------------------------------------------------------------- */
  useEffect(
    () => {
      const viewport = viewportRef.current;

      if ( !viewport ) {
        return;
      }

      const activePointers = new Map<number, PointerEvent>();
      let startDistance = 0;
      let startScale = 1;

      const distanceBetween = (
        a: PointerEvent, b: PointerEvent
      ) =>
        Math.hypot(
          a.clientX - b.clientX,
          a.clientY - b.clientY
        );

      const handlePointerDown = ( event: PointerEvent ) => {
        activePointers.set(
          event.pointerId,
          event
        );

        if ( activePointers.size === 2 ) {
          const [
            first,
            second
          ] = Array.from( activePointers.values() );

          startDistance = distanceBetween(
            first,
            second
          );
          startScale = scale;
        }
      };

      const handlePointerMove = ( event: PointerEvent ) => {
        if ( !activePointers.has( event.pointerId ) ) {
          return;
        }

        activePointers.set(
          event.pointerId,
          event
        );

        if ( activePointers.size === 2 && startDistance > 0 ) {
          const [
            first,
            second
          ] = Array.from( activePointers.values() );
          const currentDistance = distanceBetween(
            first,
            second
          );
          const pinchFactor = currentDistance / startDistance;

          applyScale( clamp(
            startScale * pinchFactor,
            MIN_SCALE,
            MAX_SCALE
          ), );
        }
      };

      const handlePointerUp = ( event: PointerEvent ) => {
        activePointers.delete( event.pointerId );
        if ( activePointers.size < 2 ) {
          startDistance = 0;
        }
      };

      viewport.addEventListener(
        "pointerdown",
        handlePointerDown
      );
      viewport.addEventListener(
        "pointermove",
        handlePointerMove
      );
      viewport.addEventListener(
        "pointerup",
        handlePointerUp
      );
      viewport.addEventListener(
        "pointercancel",
        handlePointerUp
      );

      return () => {
        viewport.removeEventListener(
          "pointerdown",
          handlePointerDown
        );
        viewport.removeEventListener(
          "pointermove",
          handlePointerMove
        );
        viewport.removeEventListener(
          "pointerup",
          handlePointerUp
        );
        viewport.removeEventListener(
          "pointercancel",
          handlePointerUp
        );
      };
    },
    [
      scale
    ]
  );

  /* ---------------------------------------------------------------- */
  /*  ResizeObserver: keep fit on viewport resize                     */
  /* ---------------------------------------------------------------- */
  useEffect(
    () => {
      if ( !viewportRef.current ) {
        return;
      }

      const observer = new ResizeObserver( fitToViewport );

      observer.observe( viewportRef.current );

      return () => observer.disconnect();
    },
    [
      fitToViewport
    ]
  );

  useEffect(
    () => {
      if ( !viewportRef.current ) {
        return;
      }

      const observer = new MutationObserver( (
        recs, obs
      ) => {
        if ( canvasRef.current ) {
          fitToViewport();
          // observer.disconnect();
        }
      } );

      observer.observe(
        document.body,
        {
          childList: true,
        }
      );

      return () => observer.disconnect();
    },
    [
      fitToViewport
    ]
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <div
      ref={viewportRef}
      className="w-full h-full overflow-hidden touch-none flex justify-center items-center"
      style={{
        touchAction: "none",
        overscrollBehavior: "contain"
      }}
    >
      <ZoomControls
        onPlus={() =>
          applyScale( clamp(
            scale + 0.1,
            MIN_SCALE,
            MAX_SCALE
          ) )
        }
        onMinus={() =>
          applyScale( clamp(
            scale - 0.1,
            MIN_SCALE,
            MAX_SCALE
          ) )
        }
        onFit={fitToViewport}
        onReset={resetToActualPixels}
      />

      <div ref={canvasRef}>
        {children}
      </div>
    </div>
  );
}
