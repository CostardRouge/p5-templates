"use client";

import React, {
  Fragment, useEffect, useRef, useState
} from "react";
import dynamic from "next/dynamic";

import useP5Template from "@/hooks/useP5Template";

import {
  getSketchOptions,
  setSketchOptions,
  subscribeSketchOptions,
} from "@/shared/syncSketchOptions";

import {
  JobModel,
  RecordingSketchOptions
} from "@/types/recording.types";
import clamp from "@/utils/clamp";
import ZoomControls from "@/components/ZoomControls";

const CaptureBanner = dynamic(
  () => import( "@/components/CaptureBanner" ),
  {
    ssr: false,
  }
);

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */
export type ClientProcessingSketchProps = {
  name: string;
  options: RecordingSketchOptions;
  persistedJob?: JobModel
  capturing: boolean
}
export default function ClientProcessingSketch( {
  name,
  options,
  capturing,
  persistedJob
}: ClientProcessingSketchProps ) {
  /* ---------------------------------------------------------------- */
  /*  Shared options state                                            */
  /* ---------------------------------------------------------------- */
  const [
    currentOptions,
    setCurrentOptions
  ] = useState<RecordingSketchOptions>( () => ( {
    ...getSketchOptions(),
    ...options,
  } ), );

  useEffect(
    () => {
      setSketchOptions(
        currentOptions,
        "react"
      );
    },
    [
      currentOptions
    ]
  );

  useEffect(
    // ( options: RecordingSketchOptions, origin: "react" | "p5" ) => void
    () => subscribeSketchOptions( ( updatedOptions: any ) => {
      setCurrentOptions( updatedOptions );
    } ),
    [
    ]
  );

  /* ---------------------------------------------------------------- */
  /*  p5 canvas creation                                              */
  /* ---------------------------------------------------------------- */
  useP5Template(
    name,
    ( canvasElement ) => {
      canvasRef.current = canvasElement;
      viewportRef.current?.appendChild( canvasElement );

      fitToViewport();
    }
  );

  /* ---------------------------------------------------------------- */
  /*  Zoom / viewport state                                           */
  /* ---------------------------------------------------------------- */
  const viewportRef = useRef<HTMLDivElement | null>( null );
  const canvasRef = useRef<HTMLCanvasElement | null>( null );
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

  const fitToViewport = () => {
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
  };

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
    ]
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <Fragment>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.sketchOptions = ${ JSON.stringify( currentOptions ) };`,
        }}
      />

      <div id="sketch-ui-drawer"></div>
      <span id="sketch-ui-icon"></span>

      {/* Zoomable viewport */}
      <div
        ref={viewportRef}
        className="w-full h-full overflow-hidden touch-none flex justify-center items-center"
        style={{
          touchAction: "none",
          overscrollBehavior: "contain"
        }}
      >
        {/* Zoom controls */}
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

        {/* Optional banner */}
        {!capturing && (
          <CaptureBanner
            name={name}
            persistedJob={persistedJob}
            options={currentOptions}
            setOptions={( updated ) =>
              setCurrentOptions( updated as RecordingSketchOptions )
            }
          />
        )}
      </div>

    </Fragment>
  );
}
