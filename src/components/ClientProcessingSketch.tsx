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
  RecordingSketchOptions
} from "@/types/recording.types";
import clamp from "@/utils/clamp";

const CaptureBanner = dynamic(
  () => import( "@/components/CaptureBanner" ),
  {
    ssr: false,
  }
);

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */
export default function ClientProcessingSketch( {
  name,
  options,
}: {
  name: string;
  options: RecordingSketchOptions;
} ) {
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

    const widthRatio = viewport.clientWidth / CANVAS_WIDTH;
    const heightRatio = viewport.clientHeight / CANVAS_HEIGHT;

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
        if ( !event.ctrlKey ) {
          return;
        } // require Ctrl / Cmd like design tools

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
        <div
          className="absolute p-2 bg-white border border-gray-400 shadow shadow-black-300 drop-shadow-sm rounded-br-sm border-t-0 top-0 left-0 z-50 flex gap-1"
        >
          <button
            onClick={() => applyScale( clamp(
              scale - 0.1,
              MIN_SCALE,
              MAX_SCALE
            ) )}
            className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-300 text-sm text-gray-500 hover:text-black active:text-black "
          >
            −
          </button>

          <button
            onClick={fitToViewport}
            className="rounded-sm bg-white border border-gray-400 px-3 py-1 shadow shadow-gray-300 text-sm text-gray-500 hover:text-black active:text-black "
          >
            Fit
          </button>

          <button
            onClick={resetToActualPixels}
            className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-300 text-sm text-gray-500 hover:text-black active:text-black "
          >
            100%
          </button>

          <button
            onClick={() => applyScale( clamp(
              scale + 0.1,
              MIN_SCALE,
              MAX_SCALE
            ) )}
            className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-300 text-sm text-gray-500 hover:text-black active:text-black "
          >
            +
          </button>
        </div>

        {/* Optional banner */}
        {options.capturing !== true && (
          <CaptureBanner
            name={name}
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
