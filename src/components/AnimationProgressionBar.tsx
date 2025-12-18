"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getSketchOptions,
  subscribeSketchOptions,
} from "@/p5-sketches/shared/syncSketchOptions";

interface AnimationProgressionBarProps {
  className?: string;
  disabled?: boolean;
}

type AnimationConfig = {
  duration: number;
  framerate: number;
  totalFrames: number;
};

type ProgressionGetter = () => number;

function clamp01( value: number ) {
  return Math.max(
    0,
    Math.min(
      1,
      value
    )
  );
}

function getAnimationConfigFromSketchOptions( sketchOptions: any ): AnimationConfig {
  const duration = sketchOptions?.animation?.duration ?? 10;
  const framerate = sketchOptions?.animation?.framerate ?? 60;
  const totalFrames = Math.max(
    1,
    Math.floor( duration * framerate )
  );

  return {
    duration,
    framerate,
    totalFrames,
  };
}

export default function AnimationProgressionBar( {
  className = "",
  disabled = false,
}: AnimationProgressionBarProps ) {
  const [
    progression,
    setProgression,
  ] = useState( 0 );
  const [
    isDragging,
    setIsDragging,
  ] = useState( false );
  const [
    hoverPosition,
    setHoverPosition,
  ] = useState<number | null>( null );

  const [
    animationConfig,
    setAnimationConfig,
  ] = useState<AnimationConfig>( () => getAnimationConfigFromSketchOptions( getSketchOptions() ) );

  const barRef = useRef<HTMLDivElement | null>( null );
  const dragThrottleRef = useRef<number>( 0 );

  const isDraggingRef = useRef( false );
  const lastProgressionRef = useRef( 0 );
  const getExternalProgressionRef = useRef<ProgressionGetter | null>( null );

  useEffect(
    () => {
      isDraggingRef.current = isDragging;
    },
    [
      isDragging,
    ]
  );

  // Keep animation config in sync with sketch options.
  useEffect(
    () => {
      if ( disabled ) {
        return;
      }

      return subscribeSketchOptions( ( updatedOptions: any ) => {
        setAnimationConfig( getAnimationConfigFromSketchOptions( updatedOptions ) );
      } );
    },
    [
      disabled,
    ]
  );

  // Prefer reading progression from the p5 util (`animation.progression`).
  // Fall back to the global window helper if the import isn't available.
  useEffect(
    () => {
      if ( disabled ) {
        return;
      }

      let cancelled = false;

      ( async() => {
        try {
          const mod = await import( "@/p5-sketches/utils/animation.js" );
          const animation = ( mod as any )?.default;

          if ( cancelled || !animation || typeof animation !== "object" ) {
            return;
          }

          getExternalProgressionRef.current = () => animation.progression;
        }
        catch {
          // Ignore; we can always fall back to `window.getAnimationProgression`.
        }
      } )();

      return () => {
        cancelled = true;
      };
    },
    [
      disabled,
    ]
  );

  // Drive the UI from a continuous progression source (raf polling).
  // This is more robust than relying on custom events being dispatched.
  useEffect(
    () => {
      if ( disabled ) {
        return;
      }

      let rafId = 0;

      const tick = () => {
        let nextProgression = lastProgressionRef.current;

        try {
          if ( typeof getExternalProgressionRef.current === "function" ) {
            nextProgression = getExternalProgressionRef.current();
          }
          else if ( typeof window.getAnimationProgression === "function" ) {
            nextProgression = window.getAnimationProgression();
          }
        }
        catch {
          // Ignore - keep previous progression.
        }

        if ( typeof nextProgression !== "number" || Number.isNaN( nextProgression ) ) {
          nextProgression = lastProgressionRef.current;
        }

        nextProgression = clamp01( nextProgression );

        if ( !isDraggingRef.current && Math.abs( nextProgression - lastProgressionRef.current ) > 0.001 ) {
          lastProgressionRef.current = nextProgression;
          setProgression( nextProgression );
        }

        rafId = requestAnimationFrame( tick );
      };

      rafId = requestAnimationFrame( tick );

      return () => {
        cancelAnimationFrame( rafId );
      };
    },
    [
      disabled,
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
    [
    ]
  );

  const setAnimationProgression = useCallback(
    ( nextProgression: number ) => {
      const clamped = clamp01( nextProgression );

      lastProgressionRef.current = clamped;
      setProgression( clamped );

      try {
        if ( typeof window.setAnimationProgression === "function" ) {
          window.setAnimationProgression( clamped );
        }
      }
      catch ( error ) {
        console.warn(
          "AnimationProgressionBar: Error setting progression:",
          error
        );
      }
    },
    [
    ]
  );

  const handleClick = useCallback(
    ( event: React.MouseEvent ) => {
      if ( disabled || isDraggingRef.current ) {
        return;
      }

      event.stopPropagation();

      setAnimationProgression( calculateProgressionFromEvent( event ) );
    },
    [
      disabled,
      calculateProgressionFromEvent,
      setAnimationProgression,
    ]
  );

  const handlePointerDown = useCallback(
    ( event: React.PointerEvent ) => {
      if ( disabled ) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      isDraggingRef.current = true;
      setIsDragging( true );

      setAnimationProgression( calculateProgressionFromEvent( event ) );

      event.currentTarget.setPointerCapture( event.pointerId );
    },
    [
      disabled,
      calculateProgressionFromEvent,
      setAnimationProgression,
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

      try {
        event.currentTarget.releasePointerCapture( event.pointerId );
      }
      catch {
        // Ignore (can throw if capture already released).
      }
    },
    [
    ]
  );

  const handlePointerMove = useCallback(
    ( event: React.PointerEvent ) => {
      if ( !isDraggingRef.current ) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      const now = Date.now();

      // Throttle drag updates to keep React + p5 happy.
      if ( now - dragThrottleRef.current < 16 ) {
        return;
      }

      dragThrottleRef.current = now;

      setAnimationProgression( calculateProgressionFromEvent( event ) );
    },
    [
      calculateProgressionFromEvent,
      setAnimationProgression,
    ]
  );

  const handleMouseMove = useCallback(
    ( event: React.MouseEvent ) => {
      if ( disabled || isDraggingRef.current ) {
        return;
      }

      event.stopPropagation();

      setHoverPosition( calculateProgressionFromEvent( event ) );
    },
    [
      disabled,
      calculateProgressionFromEvent,
    ]
  );

  const handleMouseLeave = useCallback(
    () => {
      setHoverPosition( null );
    },
    [
    ]
  );

  const handleKeyDown = useCallback(
    ( event: React.KeyboardEvent ) => {
      if ( disabled ) {
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
      disabled,
      progression,
      setAnimationProgression,
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
        currentMillis,
      };
    },
    [
      progression,
      animationConfig,
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
        hoverMillis,
      };
    },
    [
      hoverPosition,
      animationConfig,
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
    [
    ]
  );

  const ProgressBar = useMemo(
    () => (
      <div
        ref={barRef}
        role="slider"
        aria-label="Animation progression bar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={currentValues.percentage}
        tabIndex={0}
        className={`relative h-4 bg-background border border-theme touch-none ${ isDragging ? "cursor-grabbing" : "cursor-pointer" }`}
        style={{
          touchAction: "none",
        }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-progress-start to-progress-end"
          style={{
            width: `${ progression * 100 }%`,
          }}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-foreground/10 animate-pulse" />
          )}
        </div>

        {hoverPosition !== null && !isDragging && (
          <div
            className="absolute inset-y-0 w-0.5 bg-foreground pointer-events-none"
            style={{
              left: `${ hoverPosition * 100 }%`,
            }}
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
      handleKeyDown,
    ]
  );

  const ProgressInfo = useMemo(
    () => (
      <div className="flex items-center justify-between w-full mt-2 text-xs font-medium text-foreground/60 gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono">
            {currentValues.currentFrame}/{animationConfig.totalFrames}
          </span>
          <span className="text-foreground/30">·</span>
          <span className="font-mono">
            {formatTime(
              currentValues.currentSeconds,
              currentValues.currentMillis
            )}/{animationConfig.duration}s
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
            <span className="font-mono">
              {hoverValues.hoverPercentage}%
            </span>
          </div>
        )}
      </div>
    ),
    [
      currentValues,
      hoverValues,
      isDragging,
      animationConfig,
      formatTime,
    ]
  );

  if ( disabled ) {
    return null;
  }

  return (
    <div className={`w-full mx-auto px-0 ${ className }`}>
      <div className="relative">
        {ProgressBar}
        {ProgressInfo}
      </div>
    </div>
  );
}
