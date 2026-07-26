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
  EMBED_SIZE_FILL, parseEmbedHash, resolveAutoplay
} from "@/lib/embedOptions";
import type {
  AutoplayPolicy, EmbedSize
} from "@/lib/embedOptions";
import {
  applyEmbedSize, isSameSize, resolveFillSize
} from "@/lib/embedSizing";
import type {
  EmbedFrameSize
} from "@/lib/embedSizing";
import {
  FIT_MARGIN_FACTOR
} from "@/components/ScalableViewport/utils/zoomCalculations";

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
  const rootRef = useRef<HTMLDivElement | null>( null );
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
  // `#a=` is the autoplay policy, `#s=` / `#m=` shape the frame (resolution and
  // whether the sketch is inset from its edges).
  const {
    mountOptions, controls, autoplay, size, margin
  } = useMemo(
    () => {
      let merged = structuredClone( baseOptions ) as SketchOption;
      let hashControls: string[] | null = null;
      let hashAutoplay: AutoplayPolicy = "on";
      let hashSize: EmbedSize | null = null;
      let hashMargin = false;

      if ( typeof window !== "undefined" ) {
        const parsed = parseEmbedHash( window.location.hash );

        if ( parsed.options ) {
          merged.sketch = deepMerge(
            merged.sketch ?? {},
            parsed.options
          );
        }

        // A fixed resolution can be applied up front; `fill` needs the frame
        // measured first and is written in by the mount effect below.
        if ( parsed.size && parsed.size !== EMBED_SIZE_FILL ) {
          merged = applyEmbedSize(
            merged,
            parsed.size
          );
        }

        hashControls = parsed.controls;
        hashAutoplay = parsed.autoplay;
        hashSize = parsed.size;
        hashMargin = parsed.margin;
      }

      return {
        mountOptions: merged,
        controls: hashControls,
        autoplay: hashAutoplay,
        size: hashSize,
        margin: hashMargin
      };
    },
    [
      baseOptions
    ]
  );

  const fillFrame = size === EMBED_SIZE_FILL;
  // With a margin the sketch keeps the studio's gutter; without one it sits
  // flush against the frame. In fill mode there is no room to scale into, so
  // the inset is baked into the resolution instead (see `resolveFillSize`).
  const marginFactor = margin ? FIT_MARGIN_FACTOR : 1;

  // Fill mode: the canvas resolution *is* the frame's box, so it is measured
  // (not parsed) and re-applied whenever the host resizes the iframe. The first
  // measurement lands in a ref before `fillReady` flips, so the engine boots at
  // the right size; later ones are pushed through the options bus, which resizes
  // the live canvas instead of remounting the sketch.
  const fillSizeRef = useRef<EmbedFrameSize | null>( null );
  const [
    fillReady,
    setFillReady
  ] = useState( false );
  const [
    resolutionKey,
    setResolutionKey
  ] = useState( () => `${ mountOptions.size?.width ?? width }x${ mountOptions.size?.height ?? height }` );

  useEffect(
    () => {
      const frame = rootRef.current;

      if ( !fillFrame || !frame ) {
        return;
      }

      const apply = async() => {
        const next = resolveFillSize(
          frame.clientWidth,
          frame.clientHeight,
          marginFactor
        );

        if ( isSameSize(
          fillSizeRef.current,
          next
        ) ) {
          return;
        }

        const isFirst = fillSizeRef.current === null;

        fillSizeRef.current = next;
        setResolutionKey( `${ next.width }x${ next.height }` );

        if ( isFirst ) {
          setFillReady( true );
          return;
        }

        const {
          setSketchOptions
        } = await import( "@/lib/syncSketchOptions" );
        const resized = applyEmbedSize(
          mountOptions,
          next
        );

        setSketchOptions(
          {
            size: resized.size,
            ...( Array.isArray( resized.slides )
              ? {
                slides: resized.slides
              }
              : {} )
          },
          "embed"
        );
      };

      void apply();

      const observer = new ResizeObserver( () => {
        void apply();
      } );

      observer.observe( frame );

      return () => observer.disconnect();
    },
    [
      fillFrame,
      marginFactor,
      mountOptions
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
      // In fill mode the frame has to be measured before the engine can boot at
      // the right resolution — `fillReady` flips once that first measurement is
      // in. Subsequent measurements deliberately stay out of this effect's deps:
      // a resize must not remount the sketch.
      if ( !started || !containerRef.current || ( fillFrame && !fillReady ) ) {
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

      const initialOptions = fillSizeRef.current
        ? applyEmbedSize(
          mountOptions,
          fillSizeRef.current
        )
        : mountOptions;

      instance
        .init(
          containerRef.current,
          name,
          initialOptions
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
      mountOptions,
      fillFrame,
      fillReady
    ]
  );

  // Live updates: a parent frame can swap the `#o=` fragment (Keystatic preview,
  // a "reset" link) and the sketch re-parameterises without a reload. Recompute
  // the full sketch params from defaults + the new delta so removing an override
  // heals back to its default. Only params are live: `#s=` / `#m=` shape the
  // canvas and the layout it boots with, so they are read once, at mount.
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
    <div className="embed-root" ref={ rootRef }>
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
            resolutionKey={ resolutionKey }
            isReady={ ready }
            // Fill mode already sized the canvas to the frame — lay it out 1:1
            // rather than fitting a canvas that is, by construction, the frame.
            actualPixels={ fillFrame }
            fitMarginFactor={ marginFactor }
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
