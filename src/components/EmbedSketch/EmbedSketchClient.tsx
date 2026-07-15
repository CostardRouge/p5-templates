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
import EmbedPoster from "@/components/EmbedSketch/EmbedPoster";
import EmbedPlaybackToggle from "@/components/EmbedSketch/EmbedPlaybackToggle";
import {
  deepMerge, structuredClone
} from "@/p5/shared/utils.js";
import {
  parseEmbedHash, resolveAutoplay
} from "@/lib/embedOptions";
import type {
  AutoplayPolicy
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
  thumbnailUrl: string;
  hasThumbnail: boolean;
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
  thumbnailUrl,
  hasThumbnail,
  width,
  height
}: EmbedSketchClientProps ) {
  const containerRef = useRef<HTMLDivElement | null>( null );
  const engineRef = useRef<SketchEngine | null>( null );
  const [
    ready,
    setReady
  ] = useState( false );

  // `started` gates the engine mount: while false, neither the canvas nor p5
  // itself is loaded — an idle (autoplay-off) embed costs only the poster image.
  // `decided` guards SSR / first-hydration render: the autoplay decision needs
  // client-only signals (URL hash, reduced-motion, pointer type), so the server
  // and the first client render both show the neutral shell, then the mount
  // effect flips to poster or canvas — no hydration mismatch either way.
  const [
    decided,
    setDecided
  ] = useState( false );
  const [
    started,
    setStarted
  ] = useState( false );
  const [
    playing,
    setPlaying
  ] = useState( false );

  // Parse the URL fragment once: `#o=` is merged over the template defaults for
  // the initial mount, `#c=` selects which fields to expose as live controls,
  // `#a=` is the autoplay policy.
  const {
    mountOptions, controls, autoplay
  } = useMemo(
    () => {
      const merged = structuredClone( baseOptions ) as SketchOption;
      let hashControls: string[] | null = null;
      let hashAutoplay: AutoplayPolicy = "on";

      if ( typeof window !== "undefined" ) {
        const parsed = parseEmbedHash( window.location.hash );

        if ( parsed.options ) {
          merged.sketch = deepMerge(
            merged.sketch ?? {},
            parsed.options
          );
        }

        hashControls = parsed.controls;
        hashAutoplay = parsed.autoplay;
      }

      return {
        mountOptions: merged,
        controls: hashControls,
        autoplay: hashAutoplay
      };
    },
    [
      baseOptions
    ]
  );

  // Resolve autoplay against the live environment after mount, then commit the
  // start decision. reduced-motion / touch-pointer are read here (not at render)
  // so the choice never runs during SSR.
  useEffect(
    () => {
      const reducedMotion = window.matchMedia( "(prefers-reduced-motion: reduce)" ).matches;
      const mobile = window.matchMedia( "(pointer: coarse)" ).matches;
      const shouldStart = resolveAutoplay(
        autoplay,
        {
          reducedMotion,
          mobile
        }
      );

      setStarted( shouldStart );
      setPlaying( shouldStart );
      setDecided( true );
    },
    [
      autoplay
    ]
  );

  const handleStart = () => {
    setStarted( true );
    setPlaying( true );
  };

  const togglePlayback = () => {
    const engine = engineRef.current;

    if ( !engine ) {
      return;
    }

    if ( playing ) {
      engine.pause();
      setPlaying( false );
    } else {
      engine.play();
      setPlaying( true );
    }
  };

  useEffect(
    () => {
      if ( !started || !containerRef.current ) {
        return;
      }

      const registration = getEngine( engineId );
      const instance: SketchEngine = registration.createEngine();

      engineRef.current = instance;

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
        engineRef.current = null;
        setReady( false );
      };
    },
    [
      started,
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
      {decided && !started && (
        <EmbedPoster
          thumbnailUrl={ thumbnailUrl }
          hasThumbnail={ hasThumbnail }
          label={ name }
          onStart={ handleStart }
        />
      )}

      {started && (
        <>
          <ScalableViewport
            showZoomControls={ false }
            lockInteractions
            resolutionKey={ `${ width }x${ height }` }
            isReady={ ready }
          >
            <div ref={ containerRef } className="sketch-canvas-container" />
          </ScalableViewport>

          {controls && controls.length > 0 && (
            <EmbedControlPanel
              mountOptions={ mountOptions }
              formConfiguration={ formConfiguration }
              controls={ controls }
            />
          )}

          {ready && (
            <EmbedPlaybackToggle
              playing={ playing }
              onToggle={ togglePlayback }
            />
          )}
        </>
      )}
    </div>
  );
}
