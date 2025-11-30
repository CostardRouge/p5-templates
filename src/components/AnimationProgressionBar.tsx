"use client";

import {
  useState, useEffect, useRef, useCallback
} from "react";
import {
  getSketchOptions
} from "@/p5-sketches/shared/syncSketchOptions";

interface AnimationProgressionBarProps {
  className?: string;
  disabled?: boolean;
}

export default function AnimationProgressionBar( {
  className = "",
  disabled = false,
}: AnimationProgressionBarProps ) {
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
    wasLooping,
    setWasLooping
  ] = useState( true );

  const barRef = useRef<HTMLDivElement | null>( null );
  const animationFrameRef = useRef<number | undefined>( undefined );

  // Poll progression from p5 animation system
  useEffect(
    () => {
      if ( disabled ) return;

      const updateProgression = () => {
        if ( typeof window.getAnimationProgression === "function" ) {
          const currentProgression = window.getAnimationProgression();

          setProgression( currentProgression );
        }

        animationFrameRef.current = requestAnimationFrame( updateProgression );
      };

      updateProgression();

      return () => {
        if ( animationFrameRef.current ) {
          cancelAnimationFrame( animationFrameRef.current );
        }
      };
    },
    [
      disabled
    ]
  );

  // Calculate progression from mouse/pointer event
  const calculateProgressionFromEvent = useCallback(
    ( event: React.MouseEvent | React.PointerEvent | MouseEvent | PointerEvent ) => {
      if ( !barRef.current ) return 0;

      const rect = barRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const width = rect.width;
      const calculatedProgression = Math.max(
        0,
        Math.min(
          1,
          x / width
        )
      );

      return calculatedProgression;
    },
    [
    ]
  );

  // Handle click to seek
  const handleClick = useCallback(
    ( event: React.MouseEvent ) => {
      if ( disabled || isDragging ) return;

      // Prevent viewport dragging
      event.stopPropagation();

      const targetProgression = calculateProgressionFromEvent( event );

      if ( typeof window.setAnimationProgression === "function" ) {
        window.setAnimationProgression( targetProgression );
      }
    },
    [
      disabled,
      isDragging,
      calculateProgressionFromEvent
    ]
  );

  // Handle drag start
  const handlePointerDown = useCallback(
    ( event: React.PointerEvent ) => {
      if ( disabled ) return;

      // Prevent viewport dragging
      event.stopPropagation();
      event.preventDefault();

      setIsDragging( true );

      // Store current loop state and pause animation
      // Note: This assumes window.toggleLoop exists and pauses when called
      // We'll need to track if it was already paused
      setWasLooping( true ); // TODO: Get actual loop state from p5

      const targetProgression = calculateProgressionFromEvent( event );

      if ( typeof window.setAnimationProgression === "function" ) {
        window.setAnimationProgression( targetProgression );
      }

      // Capture pointer for smooth dragging
      event.currentTarget.setPointerCapture( event.pointerId );
    },
    [
      disabled,
      calculateProgressionFromEvent
    ]
  );

  // Handle drag move
  const handlePointerMove = useCallback(
    ( event: React.PointerEvent ) => {
      if ( isDragging ) {
        // Prevent viewport dragging
        event.stopPropagation();
        event.preventDefault();

        const targetProgression = calculateProgressionFromEvent( event );

        if ( typeof window.setAnimationProgression === "function" ) {
          window.setAnimationProgression( targetProgression );
        }
      }
    },
    [
      isDragging,
      calculateProgressionFromEvent
    ]
  );

  // Handle drag end
  const handlePointerUp = useCallback(
    ( event: React.PointerEvent ) => {
      if ( !isDragging ) return;

      // Prevent viewport dragging
      event.stopPropagation();

      setIsDragging( false );

      // Restore loop state if it was looping before
      // TODO: Implement proper loop state restoration

      event.currentTarget.releasePointerCapture( event.pointerId );
    },
    [
      isDragging,
    ]
  );

  // Handle hover
  const handleMouseMove = useCallback(
    ( event: React.MouseEvent ) => {
      if ( disabled || isDragging ) return;

      // Prevent viewport dragging during hover
      event.stopPropagation();

      const hoverProg = calculateProgressionFromEvent( event );

      setHoverPosition( hoverProg );
    },
    [
      disabled,
      isDragging,
      calculateProgressionFromEvent
    ]
  );

  const handleMouseLeave = useCallback(
    () => {
      setHoverPosition( null );
    },
    [
    ]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    ( event: React.KeyboardEvent ) => {
      if ( disabled ) return;

      let newProgression = progression;

      switch ( event.key ) {
        case "ArrowLeft":
          event.preventDefault();
          newProgression = Math.max(
            0,
            progression - 0.01
          ); // -1%
          break;
        case "ArrowRight":
          event.preventDefault();
          newProgression = Math.min(
            1,
            progression + 0.01
          ); // +1%
          break;
        case "Home":
          event.preventDefault();
          newProgression = 0;
          break;
        case "End":
          event.preventDefault();
          newProgression = 1;
          break;
        default:
          return;
      }

      if ( typeof window.setAnimationProgression === "function" ) {
        window.setAnimationProgression( newProgression );
      }
    },
    [
      disabled,
      progression
    ]
  );

  // Get animation configuration
  const sketchOptions = getSketchOptions();
  const duration = sketchOptions?.animation?.duration || 10; // seconds
  const framerate = sketchOptions?.animation?.framerate || 60; // fps
  const totalFrames = Math.floor( duration * framerate );

  // Calculate current values
  const percentage = Math.floor( progression * 100 );
  const currentFrame = Math.floor( progression * totalFrames );
  const currentTime = progression * duration;
  const currentSeconds = Math.floor( currentTime );
  const currentMillis = Math.floor( ( currentTime % 1 ) * 100 );

  // Calculate hover values
  const hoverPercentage = hoverPosition !== null ? Math.floor( hoverPosition * 100 ) : null;
  const hoverFrame = hoverPosition !== null ? Math.floor( hoverPosition * totalFrames ) : null;
  const hoverTime = hoverPosition !== null ? hoverPosition * duration : null;
  const hoverSeconds = hoverTime !== null ? Math.floor( hoverTime ) : null;
  const hoverMillis = hoverTime !== null ? Math.floor( ( hoverTime % 1 ) * 100 ) : null;

  // Format time display
  const formatTime = (
    seconds: number, millis: number
  ) => {
    return `${ seconds }.${ millis.toString().padStart(
      2,
      "0"
    ) }s`;
  };

  if ( disabled ) {
    return null;
  }

  return (
    <div className={`w-full mx-auto px-0 ${ className }`}>
      <div className="relative">
        {/* Progress bar */}
        <div
          ref={barRef}
          role="slider"
          aria-label="Animation progression bar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          tabIndex={0}
          className={`
            relative h-4 bg-background border border-theme
            ${ isDragging ? "cursor-grabbing" : "cursor-pointer" }
          `}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
        >
          {/* Filled portion */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-100 ease-out"
            style={{
              width: `${ progression * 100 }%`
            }}
          >
            {isDragging && (
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            )}
          </div>

          {/* Hover indicator */}
          {hoverPosition !== null && !isDragging && (
            <div
              className="absolute inset-y-0 w-0.5 bg-foreground pointer-events-none"
              style={{
                left: `${ hoverPosition * 100 }%`
              }}
            />
          )}
        </div>

        {/* Info display */}
        <div className="flex items-center justify-between mt-2 text-xs font-medium text-foreground/60 gap-4">
          {/* Current values */}
          <div className="flex items-center gap-3">
            <span className="font-mono">
              {currentFrame}/{totalFrames}
            </span>
            <span className="text-foreground/30">·</span>
            <span className="font-mono">
              {formatTime(
                currentSeconds,
                currentMillis
              )}/{duration}s
            </span>
            <span className="text-foreground/30">·</span>
            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
              {percentage}%
            </span>
          </div>

          {/* Hover preview */}
          {hoverPosition !== null && !isDragging && hoverFrame !== null && hoverSeconds !== null && hoverMillis !== null && (
            <div className="flex items-center gap-2 text-foreground/40">
              <span>→</span>
              <span className="font-mono">
                {hoverFrame}/{totalFrames}
              </span>
              <span className="text-foreground/20">·</span>
              <span className="font-mono">
                {formatTime(
                  hoverSeconds,
                  hoverMillis
                )}
              </span>
              <span className="text-foreground/20">·</span>
              <span className="font-mono">
                {hoverPercentage}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
