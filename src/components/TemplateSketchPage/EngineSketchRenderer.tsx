"use client";

import "@/engines/index"; // ensure all engines are registered in the browser bundle

import React, {
  useEffect, useRef, useState
} from "react";
import {
  getEngine
} from "@/engines/registry";
import type {
  SketchEngine
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";
import {
  EngineProvider
} from "./EngineContext";

type Props = {
  engineId: string;
  templateName: string;
  options: SketchOption;
  capturing?: boolean;
  onLoaded?: ( canvas: HTMLCanvasElement ) => void;
  children?: React.ReactNode;
};

/**
 * Engine-agnostic sketch renderer.
 *
 * Instantiates the appropriate `SketchEngine` based on `engineId`,
 * mounts it into a container div, and exposes the engine instance
 * via `EngineContext` so child components (controls, capture actions)
 * can interact with it.
 */
export default function EngineSketchRenderer( {
  engineId,
  templateName,
  options,
  capturing = false,
  onLoaded,
  children,
}: Props ) {
  const containerRef = useRef<HTMLDivElement | null>( null );
  const engineRef = useRef<SketchEngine | null>( null );
  const onLoadedRef = useRef( onLoaded );

  onLoadedRef.current = onLoaded;

  const [
    engine,
    setEngine
  ] = useState<SketchEngine | null>( null );

  /* ---- mount / unmount ------------------------------------------- */
  // Capture options at mount time — subsequent changes go via updateOptions.
  const mountOptionsRef = useRef( options );

  useEffect(
    () => {
      if ( !containerRef.current ) return;

      const registration = getEngine( engineId );
      const instance = registration.createEngine();

      engineRef.current = instance;

      instance
        .init(
          containerRef.current,
          templateName,
          mountOptionsRef.current
        )
        .then( () => {
          setEngine( instance );

          // Mark the container so the recording pipeline can detect
          // engine readiness via a generic CSS selector.
          containerRef.current?.setAttribute(
            "data-engine-ready",
            engineId
          );

          const canvas = instance.getCanvas();

          if ( canvas ) {
            onLoadedRef.current?.( canvas );
          }
        } )
        .catch( ( err ) => {
          console.error(
            `[EngineSketchRenderer] init failed for "${ engineId }"`,
            err
          );
        } );

      return () => {
        instance.destroy();
        engineRef.current = null;
        setEngine( null );
      };
      // Only re-mount when the engine or template changes, not on every
      // options change (those go through updateOptions instead).
      // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
    },
    [
      engineId,
      templateName
    ]
  );

  /* ---- live option updates --------------------------------------- */
  const prevOptionsRef = useRef( options );

  useEffect(
    () => {
      if ( prevOptionsRef.current === options ) return;
      prevOptionsRef.current = options;

      engineRef.current?.updateOptions( options );
    },
    [
      options
    ]
  );

  return (
    <EngineProvider engine={engine}>
      <div ref={containerRef} />
      {children}
    </EngineProvider>
  );
}
