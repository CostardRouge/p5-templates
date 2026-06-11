"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState
} from "react";

import {
  type AnimationBridge, onAnimationBridgeReady
} from "@/lib/animationBridge";
import {
  getSketchOptions, subscribeSketchOptions
} from "@/lib/syncSketchOptions";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  getEffectiveSlideSettings
} from "@/lib/effectiveSlideSettings";
import usePageVisibility from "@/hooks/usePageVisibility";

interface AnimationProgressionBarProps {
  className?: string;
  disabled?: boolean;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
}

type AnimationConfig = {
  duration: number;
  framerate: number;
  totalFrames: number;
};

function clamp01( value: number ) {
  return Math.max(
    0,
    Math.min(
      1,
      value
    )
  );
}

function getAnimationConfigFromSketchOptions(
  sketchOptions: any,
  activeSlideIndex?: number
): AnimationConfig {
  const {
    animation
  } = getEffectiveSlideSettings(
    sketchOptions,
    activeSlideIndex
  );
  const duration = animation?.duration ?? 10;
  const framerate = animation?.framerate ?? 60;
  const totalFrames = Math.max(
    1,
    Math.floor( duration * framerate )
  );

  return {
    duration,
    framerate,
    totalFrames
  };
}

export default function AnimationProgressionBar( {
  className = "",
  disabled = false,
  onSeekStart,
  onSeekEnd
}: AnimationProgressionBarProps ) {
  const [
    {
      activeSlideIndex,
      engine,
      looping,
      browserRecording
    },
    dispatch
  ] = useSketch();

  // A browser-side recording owns the engine clock; let the user scrub
  // mid-recording and the captured frames jump backwards (async-loop) or
  // the live stream pauses (realtime). Lock interactions while a capture
  // is in flight.
  const interactionsLocked = disabled || browserRecording;
  const activeSlideIndexRef = useRef( activeSlideIndex );

  activeSlideIndexRef.current = activeSlideIndex;

  // While the tab is hidden the engine is paused and progression can't
  // change, so there's no point spinning our polling RAF.
  const isPageVisible = usePageVisibility();

  const [
    progression,
    setProgression
  ] = useState( 0 );
  const [
    isDragging,
    setIsDragging
  ] = useState( false );
  const [
    hoverPosition,
    setHoverPosition
  ] = useState<number | null>( null );

  const [
    animationConfig,
    setAnimationConfig
  ] = useState<AnimationConfig>( () =>
    getAnimationConfigFromSketchOptions(
      getSketchOptions(),
      activeSlideIndex
    ) );

  const barRef = useRef<HTMLDivElement | null>( null );
  const dragThrottleRef = useRef<number>( 0 );
  const lastStateUpdateRef = useRef<number>( 0 );

  const isDraggingRef = useRef( false );
  const lastProgressionRef = useRef( 0 );
  const bridgeRef = useRef<AnimationBridge | null>( null );
  // Tracks whether we paused the engine loop so we only resume when we caused the pause.
  const pausedByDragRef = useRef( false );

  // Keep animation config in sync with sketch options.
  useEffect(
    () => {
      if ( disabled ) {
        return;
      }

      return subscribeSketchOptions( ( updatedOptions: any ) => {
        setAnimationConfig( getAnimationConfigFromSketchOptions(
          updatedOptions,
          activeSlideIndexRef.current
        ) );
      } );
    },
    [
      disabled
    ]
  );

  // Re-compute animation config when active slide changes.
  useEffect(
    () => {
      if ( disabled ) {
        return;
      }

      setAnimationConfig( getAnimationConfigFromSketchOptions(
        getSketchOptions(),
        activeSlideIndex
      ) );
    },
    [
      activeSlideIndex,
      disabled
    ]
  );

  // Hydrate bridgeRef as soon as the engine is ready.
  // Separated from the RAF loop so the bridge reference stays stable
  // even if disabled toggles and the loop restarts.
  useEffect(
    () => {
      if ( disabled ) {
        bridgeRef.current = null;

        return;
      }

      return onAnimationBridgeReady( ( bridge ) => {
        bridgeRef.current = bridge;

        return () => {
          bridgeRef.current = null;
        };
      } );
    },
    [
      disabled
    ]
  );

  // Pull progression from the bridge at ~30 fps via the component's own RAF.
  // Using a pull model (reading bridgeRef inside RAF) rather than a push model
  // (setState inside bridge.subscribe) avoids React detecting setState calls
  // originating from an effect context, which triggers "maximum update depth".
  useEffect(
    () => {
      if ( disabled || !isPageVisible ) {
        return;
      }

      let rafId: number;

      const tick = () => {
        if ( bridgeRef.current && !isDraggingRef.current ) {
          const next = clamp01( bridgeRef.current.getProgression() );

          if ( Math.abs( next - lastProgressionRef.current ) > 0.001 ) {
            const now = performance.now();

            if ( now - lastStateUpdateRef.current >= 33 ) {
              lastProgressionRef.current = next;
              lastStateUpdateRef.current = now;
              setProgression( next );
            }
          }
        }

        rafId = requestAnimationFrame( tick );
      };

      rafId = requestAnimationFrame( tick );

      return () => cancelAnimationFrame( rafId );
    },
    [
      disabled,
      isPageVisible
    ]
  );

  const calculateProgressionFromEvent = useCallback(
    ( event: React.MouseEvent | React.PointerEvent | MouseEvent | PointerEvent ) => {
      if ( !barRef.current ) {
        return 0;
      }

      const rect = barRef.current.getBoundingClientRect();
      const width = rect.width;

      if ( width <= 0 ) {
        return 0;
      }

      const x = event.clientX - rect.left;

      return clamp01( x / width );
    },
    []
  );

  const setAnimationProgression = useCallback(
    ( nextProgression: number ) => {
      const clamped = clamp01( nextProgression );

      lastProgressionRef.current = clamped;
      setProgression( clamped );
      bridgeRef.current?.setProgression( clamped );
    },
    []
  );

  const pauseLoopForScrubbing = useCallback(
    () => {
      if ( !looping ) {
        return false;
      }

      if ( engine ) {
        engine.pause();
      } else {
        bridgeRef.current?.pause();
      }

      dispatch( {
        type: "SET_LOOPING",
        payload: false
      } );

      return true;
    },
    [
      dispatch,
      engine,
      looping
    ]
  );

  const resumeLoopAfterScrubbing = useCallback(
    () => {
      if ( looping ) {
        return;
      }

      if ( engine ) {
        engine.play();
      } else {
        bridgeRef.current?.resume();
      }

      dispatch( {
        type: "SET_LOOPING",
        payload: true
      } );
    },
    [
      dispatch,
      engine,
      looping
    ]
  );

  const handleClick = useCallback(
    ( event: React.MouseEvent ) => {
      if ( interactionsLocked || isDraggingRef.current ) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      setAnimationProgression( calculateProgressionFromEvent( event ) );
    },
    [
      interactionsLocked,
      calculateProgressionFromEvent,
      setAnimationProgression
    ]
  );

  const handlePointerDown = useCallback(
    ( event: React.PointerEvent ) => {
      if ( interactionsLocked ) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      isDraggingRef.current = true;
      setIsDragging( true );
      onSeekStart?.();

      pausedByDragRef.current = pauseLoopForScrubbing();

      setAnimationProgression( calculateProgressionFromEvent( event ) );

      // Render one frame at the new position so the sketch isn't frozen on the old one.
      bridgeRef.current?.redraw();

      event.currentTarget.setPointerCapture( event.pointerId );
    },
    [
      interactionsLocked,
      calculateProgressionFromEvent,
      pauseLoopForScrubbing,
      setAnimationProgression,
      onSeekStart
    ]
  );

  const stopDragging = useCallback(
    ( event: React.PointerEvent ) => {
      if ( !isDraggingRef.current ) {
        return;
      }

      event.stopPropagation();

      isDraggingRef.current = false;
      setIsDragging( false );
      onSeekEnd?.();

      // Resume the loop only if we were the ones who paused it.
      if ( pausedByDragRef.current ) {
        pausedByDragRef.current = false;
        resumeLoopAfterScrubbing();
      }

      try {
        event.currentTarget.releasePointerCapture( event.pointerId );
      } catch {
      // Ignore (can throw if capture already released).
      }
    },
    [
      resumeLoopAfterScrubbing,
      onSeekEnd
    ]
  );

  const handlePointerMove = useCallback(
    ( event: React.PointerEvent ) => {
      if ( !isDraggingRef.current ) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      const now = performance.now();

      // Throttle drag updates to ~60 fps.
      if ( now - dragThrottleRef.current < 16 ) {
        return;
      }

      dragThrottleRef.current = now;

      setAnimationProgression( calculateProgressionFromEvent( event ) );

      // Render one frame at the scrubbed position while the loop is paused.
      bridgeRef.current?.redraw();
    },
    [
      calculateProgressionFromEvent,
      setAnimationProgression
    ]
  );

  const handleMouseMove = useCallback(
    ( event: React.MouseEvent ) => {
      if ( interactionsLocked || isDraggingRef.current ) {
        return;
      }

      event.stopPropagation();

      setHoverPosition( calculateProgressionFromEvent( event ) );
    },
    [
      interactionsLocked,
      calculateProgressionFromEvent
    ]
  );

  const handleMouseLeave = useCallback(
    () => {
      setHoverPosition( null );
    },
    []
  );

  const handleKeyDown = useCallback(
    ( event: React.KeyboardEvent ) => {
      if ( interactionsLocked ) {
        return;
      }

      let next = progression;

      switch ( event.key ) {
        case "ArrowLeft":
          event.preventDefault();
          next = progression - 0.01;
          break;
        case "ArrowRight":
          event.preventDefault();
          next = progression + 0.01;
          break;
        case "Home":
          event.preventDefault();
          next = 0;
          break;
        case "End":
          event.preventDefault();
          next = 1;
          break;
        default:
          return;
      }

      setAnimationProgression( next );
    },
    [
      interactionsLocked,
      progression,
      setAnimationProgression
    ]
  );

  const currentValues = useMemo(
    () => {
      const percentage = Math.floor( progression * 100 );
      const currentFrame = Math.floor( progression * animationConfig.totalFrames );
      const currentTime = progression * animationConfig.duration;
      const currentSeconds = Math.floor( currentTime );
      const currentMillis = Math.floor( ( currentTime % 1 ) * 100 );

      return {
        percentage,
        currentFrame,
        currentTime,
        currentSeconds,
        currentMillis
      };
    },
    [
      progression,
      animationConfig
    ]
  );

  const hoverValues = useMemo(
    () => {
      if ( hoverPosition === null ) {
        return null;
      }

      const hoverPercentage = Math.floor( hoverPosition * 100 );
      const hoverFrame = Math.floor( hoverPosition * animationConfig.totalFrames );
      const hoverTime = hoverPosition * animationConfig.duration;
      const hoverSeconds = Math.floor( hoverTime );
      const hoverMillis = Math.floor( ( hoverTime % 1 ) * 100 );

      return {
        hoverPercentage,
        hoverFrame,
        hoverTime,
        hoverSeconds,
        hoverMillis
      };
    },
    [
      hoverPosition,
      animationConfig
    ]
  );

  const formatTime = useCallback(
    (
      seconds: number, millis: number
    ) => {
      return `${ seconds }.${ millis.toString().padStart(
        2,
        "0"
      ) }s`;
    },
    []
  );

  const ProgressBar = useMemo(
    () => (
      <div
        ref={ barRef }
        role="slider"
        aria-label="Animation progression bar"
        aria-valuemin={ 0 }
        aria-valuemax={ 100 }
        aria-valuenow={ currentValues.percentage }
        tabIndex={ 0 }
        className={ `relative h-4 bg-background border border-theme touch-none ${ isDragging ? "cursor-grabbing" : "cursor-pointer" }` }
        style={ {
          touchAction: "none"
        } }
        onClick={ handleClick }
        onPointerDown={ handlePointerDown }
        onPointerMove={ handlePointerMove }
        onPointerUp={ stopDragging }
        onPointerCancel={ stopDragging }
        onMouseMove={ handleMouseMove }
        onMouseLeave={ handleMouseLeave }
        onKeyDown={ handleKeyDown }
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-progress-start to-progress-end"
          style={ {
            width: `${ progression * 100 }%`
          } }
        >
          {isDragging && (
            <div className="absolute inset-0 bg-foreground/10 animate-pulse" />
          )}
        </div>

        {hoverPosition !== null && !isDragging && (
          <div
            className="absolute inset-y-0 w-0.5 bg-foreground pointer-events-none"
            style={ {
              left: `${ hoverPosition * 100 }%`
            } }
          />
        )}
      </div>
    ),
    [
      currentValues.percentage,
      isDragging,
      progression,
      hoverPosition,
      handleClick,
      handlePointerDown,
      handlePointerMove,
      stopDragging,
      handleMouseMove,
      handleMouseLeave,
      handleKeyDown
    ]
  );

  const ProgressInfo = useMemo(
    () => (
      <div className="flex items-center justify-between w-full mt-1 text-xs font-medium text-foreground/60 gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono">
            {currentValues.currentFrame}/{animationConfig.totalFrames}
          </span>
          <span className="text-foreground/30">·</span>
          <span className="font-mono">
            {formatTime(
              currentValues.currentSeconds,
              currentValues.currentMillis
            )}
            /{animationConfig.duration}s
          </span>
          <span className="text-foreground/30">·</span>
          <span className="font-mono font-semibold text-active">
            {currentValues.percentage}%
          </span>
        </div>

        {hoverValues && !isDragging && (
          <div className="flex items-center gap-2 text-foreground/40">
            <span>→</span>
            <span className="font-mono">
              {hoverValues.hoverFrame}/{animationConfig.totalFrames}
            </span>
            <span className="text-foreground/20">·</span>
            <span className="font-mono">
              {formatTime(
                hoverValues.hoverSeconds,
                hoverValues.hoverMillis
              )}
            </span>
            <span className="text-foreground/20">·</span>
            <span className="font-mono">{hoverValues.hoverPercentage}%</span>
          </div>
        )}
      </div>
    ),
    [
      currentValues,
      hoverValues,
      isDragging,
      animationConfig,
      formatTime
    ]
  );

  if ( disabled ) {
    return null;
  }

  return (
    <div className={ `w-full mx-auto px-0 ${ className }` }>
      <div className="relative">
        {ProgressBar}
        {ProgressInfo}
      </div>
    </div>
  );
}
