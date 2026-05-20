"use client";

import "@/engines/index"; // ensure all engines are registered in the browser bundle

import React, {
  useEffect, useRef
} from "react";
import {
  getEngine
} from "@/engines/registry";
import type {
  SketchEngine
} from "@/engines/types";
import useSketch from "../ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

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
        instance.off(
          "ready",
          handleReady
        );
        instance.destroy();
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
