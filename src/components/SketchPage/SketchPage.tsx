"use client";

import dynamic from "next/dynamic";
import clsx from "clsx";
import type React from "react";
import {
  useCallback, useEffect, useMemo, useRef, useState
} from "react";
import EngineSketchRenderer from "@/components/SketchPage/EngineSketchRenderer";
import SketchBreadcrumb from "@/components/SketchPage/SketchBreadcrumb";
import SketchPerformanceLabel from "@/components/SketchPage/SketchPerformanceLabel";
import {
  EngineControls
} from "@/components/SketchPage/EngineControls";
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
import usePresentationMode from "@/hooks/usePresentationMode";
import {
  applyPresentationPreset,
  exitPresentation,
  registerPresentationSurface,
  togglePresentationAxis
} from "@/lib/presentation/presentationMode";
import PresentationExitButton from "@/components/SketchPage/PresentationExitButton";
import {
  usePanelDock
} from "@/hooks/usePanelDock";
import useGlobalHotkey from "@/hooks/useGlobalHotkey";
import DockedTopBar from "@/components/SketchPage/DockedTopBar";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";
import {
  STUDIO_DRAWER_HEIGHT_VAR,
  STUDIO_FILMSTRIP_HEIGHT_VAR,
  STUDIO_TRANSPORT_HEIGHT_VAR
} from "@/components/ClientProcessingSketch/components/SketchOptions/constants/drawer-events";

const SketchOptions = dynamic( () =>
  import( "@/components/ClientProcessingSketch/components/SketchOptions/SketchOptions" ) );

export default function SketchPage() {
  const [
    {
      name, capturing, options, persistedJob, engineId, category, sketchLoaded, activeSlideIndex,
      engine, looping, browserRecording
    },
    dispatch
  ] = useSketch();

  // Docked workspace layout (desktop only): a squared, edge-to-edge chrome —
  // a top bar plus left/right rails and a bottom filmstrip band — frames the
  // viewport, which fits the space between them. The rails' widths (w-80 /
  // w-72) and the top bar's height (h-12) are mirrored as insets below; the
  // filmstrip's height travels through its CSS variable. The left rail always
  // exists now: it hosts canvas & animation even when the sketch exposes no
  // parameters of its own.
  const {
    docked
  } = usePanelDock();
  const isDesktop = useMediaQuery( "(min-width: 768px)" );
  const dockedDesktop = docked && isDesktop && sketchLoaded && !capturing;
  const reserveLeft = dockedDesktop;
  const reserveRight = dockedDesktop;

  // Presentation mode — three independent axes (fullscreen · hide interface ·
  // stretch canvas), driven from the zoom-controls hover menu and the shortcuts
  // below. The viewport element registered here is what the stretch *measures*;
  // the Fullscreen API targets the document root, which is what lets the
  // interface stay up in fullscreen ("Focus") instead of being wiped by the
  // browser. See src/lib/presentation/presentationMode.ts.
  const {
    hideInterface, stretchCanvas, isPresenting
  } = usePresentationMode();

  const registerViewport = useCallback(
    ( el: HTMLDivElement | null ) => registerPresentationSurface( el ),
    []
  );

  const hotkeysEnabled = sketchLoaded && !capturing;

  // One key per axis, plus "P" for the Present preset (all three at once — the
  // shop/expo mode). Note "F" now toggles fullscreen *only*: it no longer hides
  // the studio, which is the whole point of splitting the axes.
  useGlobalHotkey( {
    code: "KeyF",
    onTrigger: useCallback(
      () => togglePresentationAxis( "fullscreen" ),
      []
    ),
    enabled: hotkeysEnabled && isDesktop
  } );

  useGlobalHotkey( {
    code: "KeyH",
    onTrigger: useCallback(
      () => togglePresentationAxis( "hideInterface" ),
      []
    ),
    enabled: hotkeysEnabled
  } );

  useGlobalHotkey( {
    code: "KeyL",
    onTrigger: useCallback(
      () => togglePresentationAxis( "stretchCanvas" ),
      []
    ),
    enabled: hotkeysEnabled
  } );

  useGlobalHotkey( {
    code: "KeyP",
    onTrigger: useCallback(
      () => applyPresentationPreset( "present" ),
      []
    ),
    enabled: hotkeysEnabled && isDesktop
  } );

  // The browser hands Esc back only while the Fullscreen API is engaged; "Fill
  // the page" and "Clean preview" hide everything without it, so Esc has to be
  // ours too. Not routed through useGlobalHotkey: Esc must still work with a
  // button focused, and dismissing a dialog has to win over leaving the mode.
  useEffect(
    () => {
      if ( !isPresenting ) {
        return;
      }

      const onKeyDown = ( event: KeyboardEvent ) => {
        const target = event.target as HTMLElement | null;

        if ( event.key !== "Escape" || target?.closest( "[role=\"dialog\"], [aria-modal=\"true\"]" ) ) {
          return;
        }

        exitPresentation();
      };

      window.addEventListener(
        "keydown",
        onKeyDown
      );

      return () => window.removeEventListener(
        "keydown",
        onKeyDown
      );
    },
    [
      isPresenting
    ]
  );

  // Portal targets inside the docked top bar: the viewport's zoom controls,
  // and the options form's bar actions (undo/redo + Export — filled by
  // SketchOptions, which owns the form context they need).
  const [
    zoomSlot,
    setZoomSlot
  ] = useState<HTMLDivElement | null>( null );
  const [
    actionsSlot,
    setActionsSlot
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
    (
      updatedOptions: SketchOption | ( ( existingOptions: SketchOption ) => void ),
      changedPaths?: string[]
    ) => {
      dispatch( {
        type: "SET_OPTIONS",
        payload: updatedOptions as SketchOption,
        changedPaths
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
  // the sketch itself stays unaware of the UI. Mirrors the engine's
  // effectiveInteractive precedence: a sketch-declared `interaction` block
  // (slide sketch over global, like slides.getSketchSettings()) wins; the
  // binding plugin's `interactive.interaction` namespace (slide over root)
  // fills in when the sketch declares none.
  const disableTouchGestures = useMemo(
    () => {
      const slide = activeSlideIndex !== undefined
        ? options?.slides?.[ activeSlideIndex ]
        : undefined;
      const interaction = (
        slide?.sketch?.interaction ??
        options?.sketch?.interaction ??
        slide?.interactive?.interaction ??
        options?.interactive?.interaction
      ) as
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
              data-pin-nopin="true"
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
          // The insets key off `hideInterface`, never off fullscreen: "Focus"
          // is fullscreen *with* the studio chrome, so its layout must stay
          // exactly the docked one, only larger. With the chrome gone the
          // viewport owns the whole surface — drop the insets and the mobile
          // top strip, and give it a solid backdrop.
          //
          // `h-full` is load-bearing: the inline height below is what gives
          // this element a box, and it goes with the insets. Fullscreen used to
          // cover for that (the browser sizes the fullscreen element itself),
          // but "Fill the page" and "Clean preview" hide the chrome without it,
          // and an unsized wrapper collapses — the stretch then measures a zero
          // box and the canvas silently keeps the framed size.
          hideInterface
            ? "h-full bg-background"
            : "pt-12 md:pt-0",
          // Nothing frames the canvas in presentation — suppress the on-hover
          // outline (see the `.presentation-bare` rule in globals.css).
          hideInterface && "presentation-bare",
          // Docked: inset the viewport by the top bar (h-12) and the rails
          // (w-80 / w-72) so it fits the framed area. The container resize
          // triggers ScalableViewport's refit observer.
          !hideInterface && dockedDesktop && "md:mt-12",
          !hideInterface && reserveLeft && "md:ml-80",
          !hideInterface && reserveRight && "md:mr-72",
          !hideInterface && ( reserveLeft || reserveRight || dockedDesktop ) && "md:w-auto"
        ) }
        style={ hideInterface ? undefined : {
          // Every layout now ends on the transport bar, so its height comes
          // off the viewport in all of them; the docked top bar (3rem) and the
          // filmstrip band only exist in the docked one, and the drawer
          // variable is 0 outside mobile.
          height: dockedDesktop
            ? `calc(100% - 3rem - var(${ STUDIO_TRANSPORT_HEIGHT_VAR }, 0px) - var(${ STUDIO_FILMSTRIP_HEIGHT_VAR }, 0px) - var(${ STUDIO_DRAWER_HEIGHT_VAR }, 0px))`
            : `calc(100% - var(${ STUDIO_TRANSPORT_HEIGHT_VAR }, 0px) - var(${ STUDIO_DRAWER_HEIGHT_VAR }, 0px))`
        } }
        hidden={ !sketchLoaded }
      >
        <ScalableViewport
          disable={ capturing }
          showZoomControls={ !capturing && sketchLoaded && !hideInterface }
          resolutionKey={ `${ effectiveSettings.size.width }x${ effectiveSettings.size.height }` }
          isReady={ sketchLoaded }
          disableTouchGestures={ disableTouchGestures }
          lockInteractions={ browserRecording }
          docked={ dockedDesktop }
          zoomControlsContainer={ zoomSlot }
          actualPixels={ stretchCanvas }
          onInteractionStart={ handleInteractionStart }
          onInteractionEnd={ handleInteractionEnd }
        >
          {/* Docked: the top bar already names the engine/category/sketch and
              hosts the fps readout beside the zoom controls, so this overlay
              would just repeat both over the canvas. */}
          {sketchLoaded && !capturing && !hideInterface && !dockedDesktop && (
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
        </ScalableViewport>

        {/* With the chrome hidden the zoom-controls menu is gone with it, so
            this is the only visible way back — in every layout, and whether or
            not the Fullscreen API is engaged. */}
        {hideInterface && <PresentationExitButton />}
      </div>

      {/* Controls & options panel */}
      { sketchLoaded && !capturing && (
        <>
          {/* Docked: the top bar hosts the menu, engine and zoom controls,
              flat and edge-to-edge. Floating: the engine controls are their
              own island (menu and zoom float in the corners). Both are chrome,
              so both go while the interface is hidden — the form below stays
              mounted regardless (it owns the capture dialog's autosave handle
              and any running recording). */}
          {!hideInterface && ( dockedDesktop ? (
            <DockedTopBar
              zoomSlotRef={ setZoomSlot }
              actionsSlotRef={ setActionsSlot }
              targetFps={ effectiveSettings.animation?.framerate ?? 60 }
              interactionMode={ interactionMode }
            />
          ) : (
            <EngineControls />
          ) )}

          <SketchOptions
            name={ name }
            options={ options }
            persistedJob={ persistedJob }
            onOptionsChange={ handleOptionsChange }
            onActiveSlideChange={ handleActiveSlideChange }
            onSeekStart={ handleSeekStart }
            onSeekEnd={ handleSeekEnd }
            topBarActionsContainer={ dockedDesktop ? actionsSlot : null }
          />
        </>
      ) }
    </>
  );
}
