"use client";

import dynamic from "next/dynamic";
import clsx from "clsx";
import {
  Minimize
} from "lucide-react";
import type React from "react";
import {
  useCallback, useEffect, useMemo, useRef, useState
} from "react";
import EngineSketchRenderer from "@/components/TemplateSketchPage/EngineSketchRenderer";
import SketchBreadcrumb from "@/components/TemplateSketchPage/SketchBreadcrumb";
import SketchPerformanceLabel from "@/components/TemplateSketchPage/SketchPerformanceLabel";
import {
  EngineControls
} from "@/components/TemplateSketchPage/EngineControls";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";
import type {
  SketchOption
} from "@/types/sketch.types";
import {
  getEffectiveSlideSettings
} from "@/lib/effectiveSlideSettings";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  useSketchThumbnail
} from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketchThumbnail";
import useSketchDevWatch from "@/hooks/useSketchDevWatch";
import usePageVisibility from "@/hooks/usePageVisibility";
import useMediaQuery from "@/hooks/useMediaQuery";
import useFullscreenViewport from "@/hooks/useFullscreenViewport";
import {
  exitViewportFullscreen,
  registerFullscreenTarget,
  toggleViewportFullscreen
} from "@/lib/fullscreen/fullscreenViewport";
import {
  usePanelDock
} from "@/hooks/usePanelDock";
import DockedTopBar from "@/components/TemplateSketchPage/DockedTopBar";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";
import {
  STUDIO_DRAWER_HEIGHT_VAR
} from "@/components/ClientProcessingSketch/components/TemplateOptions/constants/drawer-events";

const TemplateOptions = dynamic( () =>
  import( "@/components/ClientProcessingSketch/components/TemplateOptions/TemplateOptions" ) );

// AnimationProgressionBar is a self-contained scrubber subtree (RAF polling,
// pointer/scrub handlers, animationBridge/syncSketchOptions wiring) that only
// renders once `sketchLoaded && !capturing`. Load it as a separate chunk so it
// stays out of the sketch page's initial compile.
const AnimationProgressionBar = dynamic( () =>
  import( "@/components/AnimationProgressionBar" ) );

export default function TemplateSketchPage() {
  const [
    {
      name, capturing, options, persistedJob, engineId, category, sketchLoaded, activeSlideIndex,
      engine, looping, browserRecording, sketchFormConfiguration
    },
    dispatch
  ] = useSketch();

  // Docked workspace layout (desktop only): a squared, edge-to-edge chrome —
  // a top bar plus left/right rails — frames the viewport, which fits the
  // space between them. The rails' widths (w-80 / w-72) and the top bar's
  // height (h-12) are mirrored as insets below. The left rail only appears
  // when the sketch actually has a settings panel.
  const {
    docked
  } = usePanelDock();
  const isDesktop = useMediaQuery( "(min-width: 768px)" );
  const hasSketchSettingsPanel = Boolean( sketchFormConfiguration && Object.keys( sketchFormConfiguration ).length > 0 );
  const dockedDesktop = docked && isDesktop && sketchLoaded && !capturing;
  const reserveLeft = dockedDesktop && hasSketchSettingsPanel;
  const reserveRight = dockedDesktop;

  // Fullscreen mode (desktop only, official Fullscreen API). The viewport
  // wrapper below is the element that goes fullscreen; the size select and the
  // zoom-controls button both drive the shared controller.
  const {
    isFullscreen, isSupported: fullscreenSupported
  } = useFullscreenViewport();
  const fullscreenAvailable = isDesktop && fullscreenSupported;

  const registerViewport = useCallback(
    ( el: HTMLDivElement | null ) => registerFullscreenTarget( el ),
    []
  );

  // Portal target for the viewport's zoom controls when docked (they render
  // flat inside the top bar instead of floating top-right).
  const [
    zoomSlot,
    setZoomSlot
  ] = useState<HTMLDivElement | null>( null );

  const [
    interactionMode,
    setInteractionMode
  ] = useState<"panning" | "zooming" | "seeking" | null>( null );

  // Capture whether the sketch was looping at the moment a viewport gesture
  // starts, so we can restore the exact state when the gesture ends.
  const wasLoopingRef = useRef( false );
  // True while the user is scrubbing the progression bar. `interactionMode` is
  // shared with the viewport pan/zoom gestures, and those gestures still fire
  // (and get cancelled) when the pointer goes down on the progression bar —
  // their trailing onInteractionEnd would otherwise clobber the "seeking"
  // label mid-scrub. This flag lets seeking take priority over pan/zoom.
  const isSeekingRef = useRef( false );
  // Keep a stable ref to the latest engine/looping values to avoid stale closures.
  const interactionStateRef = useRef( {
    engine,
    looping
  } );

  interactionStateRef.current = {
    engine,
    looping
  };

  const handleInteractionStart = useCallback(
    ( mode: "panning" | "zooming" ) => {
      // A scrub in progress owns the label; don't let a stray viewport
      // gesture (e.g. a wheel event while holding the bar) override it.
      if ( isSeekingRef.current ) {
        return;
      }

      setInteractionMode( mode );

      const {
        engine: e, looping: l
      } = interactionStateRef.current;

      if ( e && l ) {
        wasLoopingRef.current = true;
        e.pause();
      }
    },
    []
  );

  const handleInteractionEnd = useCallback(
    () => {
      // While scrubbing, the cancelled viewport drag still emits a drag-end.
      // Ignore it so the "seeking" label survives until the scrub really ends.
      if ( isSeekingRef.current ) {
        return;
      }

      setInteractionMode( null );

      const {
        engine: e
      } = interactionStateRef.current;

      if ( e && wasLoopingRef.current ) {
        wasLoopingRef.current = false;
        e.play();
      }
    },
    []
  );

  // Pause the engine when the tab is hidden, resume it when the tab
  // comes back — but only if the user actually intended the sketch to
  // be playing (looping state). This is engine-agnostic: any engine
  // that implements SketchEngine.play/pause benefits automatically.
  const isPageVisible = usePageVisibility();

  useEffect(
    () => {
      if ( !engine || !looping ) {
        return;
      }

      if ( isPageVisible ) {
        engine.play();
      } else {
        engine.pause();
      }
    },
    [
      engine,
      looping,
      isPageVisible
    ]
  );

  const handleSeekStart = useCallback(
    () => {
      isSeekingRef.current = true;
      setInteractionMode( "seeking" );
    },
    []
  );

  const handleSeekEnd = useCallback(
    () => {
      isSeekingRef.current = false;
      setInteractionMode( null );
    },
    []
  );

  const {
    thumbnailUrl
  } = useSketchThumbnail( {
    name,
    persistedJob,
    engine: engineId
  } );

  useSketchDevWatch(
    name,
    engineId,
    capturing
  );

  const handleOptionsChange = useCallback(
    ( updatedOptions: SketchOption | ( ( existingOptions: SketchOption ) => void ) ) => {
      dispatch( {
        type: "SET_OPTIONS",
        payload: updatedOptions as SketchOption
      } );
    },
    [
      dispatch
    ]
  );

  const handleActiveSlideChange = useCallback(
    ( index: number | undefined ) => {
      dispatch( {
        type: "SET_ACTIVE_SLIDE",
        payload: index
      } );
    },
    [
      dispatch
    ]
  );

  const effectiveSettings = useMemo(
    () => getEffectiveSlideSettings(
      options,
      activeSlideIndex
    ),
    [
      options,
      activeSlideIndex
    ]
  );

  // When the sketch consumes touch input (interaction.touch source), hand the
  // touchscreen over to it: the viewport must not pan/zoom — nor pause the
  // loop — on finger gestures. The options store is the only bridge needed;
  // the sketch itself stays unaware of the UI. Mirrors the runtime merge in
  // slides.getSketchSettings(): a slide-level `sketch` shallowly overrides
  // the global one, so its `interaction` block wins when present.
  const disableTouchGestures = useMemo(
    () => {
      const slideSketch = activeSlideIndex !== undefined
        ? options?.slides?.[ activeSlideIndex ]?.sketch
        : undefined;
      const interaction = ( slideSketch?.interaction ?? options?.sketch?.interaction ) as
        | { enabled?: boolean;
          touch?: { enabled?: boolean } }
        | undefined;

      return interaction?.enabled !== false && interaction?.touch?.enabled === true;
    },
    [
      options,
      activeSlideIndex
    ]
  );

  return (
    <>
      {/* Loading placeholder */}
      {!sketchLoaded && (
        <div className="flex items-center justify-center absolute h-full w-full">
          <div className="flex flex-col items-center gap-4">
            <img
              src={ thumbnailUrl }
              alt={ `${ name } thumbnail` }
              className="w-60 h-auto rounded-lg shadow-lg"
              onError={ ( e ) => {
                const fallback = getSketchThumbnailURL(
                  engineId,
                  name
                );

                if ( e.currentTarget.src !== window.location.origin + fallback ) {
                  e.currentTarget.src = fallback;
                }
              } }
            />

            <p className="text-foreground">
              {" → loading "}
              <span className="font-bold">{name}</span> ({engineId})
            </p>
          </div>
        </div>
      )}

      {/* Sketch viewport — shrinks above the open mobile drawer so
          fit-to-viewport targets the visible area (the container resize
          triggers ScalableViewport's own refit observer). On mobile we
          also reserve the top strip occupied by the engine and zoom
          controls so the sketch header (engine · name · perf) never
          slides under them when the drawer compresses the viewport. */}
      <div
        ref={ registerViewport }
        className={ clsx(
          "w-full relative",
          // Fullscreen owns the whole screen: the browser sizes this element to
          // fill the display, so drop the layout insets/padding and just give
          // it a solid backdrop.
          isFullscreen
            ? "bg-background"
            : "pt-12 md:pt-0",
          // Docked: inset the viewport by the top bar (h-12) and the rails
          // (w-80 / w-72) so it fits the framed area. The container resize
          // triggers ScalableViewport's refit observer.
          !isFullscreen && dockedDesktop && "md:mt-12",
          !isFullscreen && reserveLeft && "md:ml-80",
          !isFullscreen && reserveRight && "md:mr-72",
          !isFullscreen && ( reserveLeft || reserveRight || dockedDesktop ) && "md:w-auto"
        ) }
        style={ isFullscreen ? undefined : {
          height: dockedDesktop
            ? `calc(100% - 3rem - var(${ STUDIO_DRAWER_HEIGHT_VAR }, 0px))`
            : `calc(100% - var(${ STUDIO_DRAWER_HEIGHT_VAR }, 0px))`
        } }
        hidden={ !sketchLoaded }
      >
        <ScalableViewport
          disable={ capturing }
          showZoomControls={ !capturing && sketchLoaded }
          resolutionKey={ `${ effectiveSettings.size.width }x${ effectiveSettings.size.height }` }
          isReady={ sketchLoaded }
          disableTouchGestures={ disableTouchGestures }
          lockInteractions={ browserRecording }
          docked={ dockedDesktop }
          zoomControlsContainer={ zoomSlot }
          showFullscreen={ fullscreenAvailable }
          isFullscreen={ isFullscreen }
          onToggleFullscreen={ toggleViewportFullscreen }
          onInteractionStart={ handleInteractionStart }
          onInteractionEnd={ handleInteractionEnd }
        >
          {sketchLoaded && !capturing && (
            <div
              onClick={ ( e ) => e.stopPropagation() }
              className="flex justify-between font-mono text-sm mt-2"
              style={
                {
                  "--scale-factor": "var(--viewport-scale, 1)",
                  transform: "scale(calc(1 / var(--scale-factor)))",
                  transformOrigin: "bottom left",
                  width: "calc(100% * var(--scale-factor))"
                } as React.CSSProperties
              }
            >
              <SketchBreadcrumb
                engineId={ engineId }
                name={ name }
                category={ category }
                activeSlideIndex={ activeSlideIndex }
              />

              <SketchPerformanceLabel
                targetFps={ effectiveSettings.animation?.framerate ?? 60 }
                interactionMode={ interactionMode }
              />
            </div>
          )}

          <EngineSketchRenderer />

          {sketchLoaded && !capturing && (
            <div
              className="mt-2 mb-4 truncate"
              data-no-drag="true"
              style={
                {
                  "--scale-factor": "var(--viewport-scale, 1)",
                  transform: "scale(calc(1 / var(--scale-factor)))",
                  transformOrigin: "top left",
                  width: "calc(100% * var(--scale-factor))"
                } as React.CSSProperties
              }
            >
              <AnimationProgressionBar
                onSeekStart={ handleSeekStart }
                onSeekEnd={ handleSeekEnd }
              />
            </div>
          )}
        </ScalableViewport>

        {/* Docked fullscreen hides the top bar (and with it the zoom-controls
            fullscreen button), so surface a dedicated exit affordance. The
            floating layout keeps its zoom controls on-screen, so it doesn't
            need one. Esc always works either way. */}
        {isFullscreen && dockedDesktop && (
          <button
            onClick={ () => void exitViewportFullscreen() }
            title="Exit fullscreen (Esc)"
            aria-label="Exit fullscreen"
            className="absolute top-4 right-4 z-50 inline-flex items-center gap-1.5 h-9 px-3 bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md text-foreground/70 hover:text-foreground hover:bg-hover transition-colors"
          >
            <Minimize className="w-4 h-4" />
            <span className="text-xs font-semibold">Exit fullscreen</span>
          </button>
        )}
      </div>

      {/* Controls & options panel */}
      { sketchLoaded && !capturing && (
        <>
          {/* Docked: the top bar hosts the menu, engine and zoom controls,
              flat and edge-to-edge. Floating: the engine controls are their
              own island (menu and zoom float in the corners). */}
          {dockedDesktop ? (
            <DockedTopBar zoomSlotRef={ setZoomSlot } />
          ) : (
            <EngineControls />
          )}

          <TemplateOptions
            name={ name }
            options={ options }
            persistedJob={ persistedJob }
            onOptionsChange={ handleOptionsChange }
            onActiveSlideChange={ handleActiveSlideChange }
          />
        </>
      ) }
    </>
  );
}
