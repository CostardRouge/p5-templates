"use client";

import "@/engines/index"; // ensure all engines are registered in the browser bundle

import React, {
  useEffect, useRef
} from "react";
import {
  getEngine
} from "@/engines/registry";
import type {
  SketchEngine,
  EngineEventMap
} from "@/engines/types";
import useSketch from "../ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  registerNavigationPause
} from "@/lib/navigationPauseSignal";

/**
 * Engine-agnostic sketch renderer.
 *
 * Instantiates the appropriate `SketchEngine` based on `engineId`,
 * mounts it into a container div, and dispatches the engine instance
 * + loaded state into SketchContext so sibling components (controls,
 * capture actions) can interact with it.
 */
export default function EngineSketchRenderer() {
  const [
    {
      options, name, engineId
    },
    dispatch
  ] = useSketch();
  const containerRef = useRef<HTMLDivElement | null>( null );
  const engineRef = useRef<SketchEngine | null>( null );

  const mountOptionsRef = useRef( options );

  useEffect(
    () => {
      if ( !containerRef.current ) {
        return;
      }

      const registration = getEngine( engineId );
      const instance = registration.createEngine();

      engineRef.current = instance;

      const unregisterPause = registerNavigationPause( () => {
        engineRef.current?.pause();
      } );

      // Listen for the engine's ready event to know when the first frame
      // has been rendered and the canvas is ready to be measured/centered.
      const handleReady = () => {
        dispatch( {
          type: "SET_LOADED",
          payload: true
        } );

        // Mark the container so the recording pipeline can detect
        // engine readiness via a generic CSS selector.
        containerRef.current?.setAttribute(
          "data-engine-ready",
          engineId
        );
      };

      instance.on(
        "ready",
        handleReady
      );

      // Mirror the engine's per-asset loading report into the context so
      // the loading placeholder can show which step is in flight.
      const handleLoading = ( progress: EngineEventMap[ "loading" ] ) => {
        dispatch( {
          type: "SET_LOADING_PROGRESS",
          payload: progress
        } );
      };

      instance.on(
        "loading",
        handleLoading
      );

      instance
        .init(
          containerRef.current,
          name,
          mountOptionsRef.current
        )
        .then( () => {
          dispatch( {
            type: "SET_ENGINE",
            payload: instance
          } );
        } )
        .catch( ( error ) => {
          console.error(
            `[EngineSketchRenderer] init failed for "${ engineId }"`,
            error
          );
        } );

      return () => {
        unregisterPause();
        instance.off(
          "ready",
          handleReady
        );
        instance.off(
          "loading",
          handleLoading
        );
        instance.destroy();
        dispatch( {
          type: "SET_LOADING_PROGRESS",
          payload: null
        } );
        engineRef.current = null;
        dispatch( {
          type: "SET_ENGINE",
          payload: null
        } );
        dispatch( {
          type: "SET_LOADED",
          payload: false
        } );
      };
    },
    [
      engineId,
      dispatch,
      name
    ]
  );

  return <div ref={ containerRef } className="sketch-canvas-container" />;
}
