"use client";

import "@/engines/index"; // register p5/gsap/threejs in the browser bundle

import dynamic from "next/dynamic";
import {
  useEffect, useMemo, useRef, useState
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
import type {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";
import {
  deepMerge, structuredClone
} from "@/p5/shared/utils.js";
import {
  parseEmbedHash
} from "@/lib/embedOptions";

// The control strip pulls in the whole FieldRenderer subtree (RHF + every
// Controlled* input). Load it as its own chunk, mounted only when the URL asks
// for controls (#c=), so a display-only embed stays lean.
const EmbedControlPanel = dynamic(
  () => import( "@/components/EmbedSketch/EmbedControlPanel" ),
  {
    ssr: false
  }
);

type EmbedSketchClientProps = {
  engineId: string;
  name: string;
  /** Template defaults (OptionsSchema base + form defaults on `.sketch`). */
  baseOptions: SketchOption;
  /** Per-field UI config, used to render whitelisted controls. */
  formConfiguration?: Record<string, FieldConfig>;
  width: number;
  height: number;
};

/**
 * Standalone, chrome-free sketch host for the `/embed` route.
 *
 * Deliberately does NOT use SketchContext / SketchPage: it drives the engine
 * directly, so the heavy editor surface (RHF form, capture actions →
 * mediabunny/gif.js, thumbnails, dev-watch) never enters the embed bundle. The
 * only weight is the engine core + p5 itself. Interaction is preserved — the
 * viewport is fit-to-frame but its pan/zoom gestures are locked, so pointer and
 * touch events reach the canvas for camera/mic/orbit-driven sketches.
 */
export default function EmbedSketchClient( {
  engineId,
  name,
  baseOptions,
  formConfiguration,
  width,
  height
}: EmbedSketchClientProps ) {
  const containerRef = useRef<HTMLDivElement | null>( null );
  const [
    ready,
    setReady
  ] = useState( false );

  // The control whitelist comes from the URL fragment, which only exists on the
  // client — so the panel must not participate in SSR / first-hydration render
  // or its presence would diverge from the server markup. Flip on after mount.
  const [
    hydrated,
    setHydrated
  ] = useState( false );

  useEffect(
    () => setHydrated( true ),
    []
  );

  // Parse the URL fragment once: `#o=` is merged over the template defaults for
  // the initial mount, `#c=` selects which fields to expose as live controls.
  // Reading location.hash during render is stable for the mount, and the
  // container markup is identical with or without a hash, so there is no
  // hydration mismatch.
  const {
    mountOptions, controls
  } = useMemo(
    () => {
      const merged = structuredClone( baseOptions ) as SketchOption;
      let hashControls: string[] | null = null;

      if ( typeof window !== "undefined" ) {
        const parsed = parseEmbedHash( window.location.hash );

        if ( parsed.options ) {
          merged.sketch = deepMerge(
            merged.sketch ?? {},
            parsed.options
          );
        }

        hashControls = parsed.controls;
      }

      return {
        mountOptions: merged,
        controls: hashControls
      };
    },
    [
      baseOptions
    ]
  );

  useEffect(
    () => {
      if ( !containerRef.current ) {
        return;
      }

      const registration = getEngine( engineId );
      const instance: SketchEngine = registration.createEngine();

      const handleReady = () => setReady( true );

      instance.on(
        "ready",
        handleReady
      );

      instance
        .init(
          containerRef.current,
          name,
          mountOptions
        )
        .catch( ( error ) => {
          console.error(
            `[EmbedSketchClient] init failed for "${ engineId }/${ name }"`,
            error
          );
        } );

      return () => {
        instance.off(
          "ready",
          handleReady
        );
        instance.destroy();
        setReady( false );
      };
    },
    [
      engineId,
      name,
      mountOptions
    ]
  );

  // Live updates: a parent frame can swap the `#o=` fragment (Keystatic preview,
  // a "reset" link) and the sketch re-parameterises without a reload. Recompute
  // the full sketch params from defaults + the new delta so removing an override
  // heals back to its default.
  useEffect(
    () => {
      const onHashChange = async() => {
        const {
          options
        } = parseEmbedHash( window.location.hash );

        const {
          setSketchOptions
        } = await import( "@/lib/syncSketchOptions" );

        setSketchOptions(
          {
            sketch: deepMerge(
              structuredClone( baseOptions.sketch ?? {} ),
              options ?? {}
            )
          },
          "embed"
        );
      };

      window.addEventListener(
        "hashchange",
        onHashChange
      );

      return () =>
        window.removeEventListener(
          "hashchange",
          onHashChange
        );
    },
    [
      baseOptions
    ]
  );

  return (
    <div className="embed-root">
      <ScalableViewport
        showZoomControls={ false }
        lockInteractions
        resolutionKey={ `${ width }x${ height }` }
        isReady={ ready }
      >
        <div ref={ containerRef } className="sketch-canvas-container" />
      </ScalableViewport>

      {hydrated && controls && controls.length > 0 && (
        <EmbedControlPanel
          mountOptions={ mountOptions }
          formConfiguration={ formConfiguration }
          controls={ controls }
        />
      )}
    </div>
  );
}
