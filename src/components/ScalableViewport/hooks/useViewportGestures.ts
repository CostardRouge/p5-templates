import {
  useRef
} from "react";
import {
  useGesture
} from "@use-gesture/react";
import type {
  TransformState
} from "./useTransformState";
import {
  MIN_SCALE,
  MAX_SCALE,
  calculateZoomTarget
} from "../utils/zoomCalculations";

// A trackpad pinch reaches the page as a wheel event with `ctrlKey` set (every
// browser synthesises it that way); use-gesture's pinch recogniser claims those
// (`pinchOnWheel`, on by default, keyed on this modifier). A plain two-finger
// scroll is an unmodified wheel event and must only pan: it used to zoom, which
// made every trackpad pan zoom as well. Keeping the modifier here lets the wheel
// handlers below leave pinch events to the pinch recogniser — otherwise the
// zoom applies twice and the interaction callbacks interleave.
export const PINCH_WHEEL_MODIFIER = "ctrlKey" as const;

export function isPinchWheelEvent( event: WheelEvent ): boolean {
  return Boolean( event[ PINCH_WHEEL_MODIFIER ] );
}

// How much one pixel of mouse-wheel travel zooms: `exp( -deltaY * k )`, the
// factor the wheel always used before it learned to pan.
export const WHEEL_ZOOM_PER_PIXEL = 0.01;

/**
 * A mouse wheel ZOOMS; a two-finger trackpad scroll PANS. Both arrive as plain
 * wheel events, told apart by what only a wheel does:
 * - it scrolls in lines (`deltaMode` 1 — Firefox reports every notch so);
 * - it has one axis, where two fingers always drift on both (`deltaX`);
 * - in Chromium and WebKit, its legacy `wheelDeltaY` is a ±120 notch, while a
 *   trackpad's is exactly −3 × its pixel `deltaY` (± rounding at page zoom).
 * Anything that fits none of these is treated as a trackpad, so a scroll
 * nobody can classify still pans, as it did before.
 */
export function isMouseWheelEvent( event: WheelEvent ): boolean {
  if ( event.deltaMode !== 0 ) {
    return true;
  }

  if ( event.deltaX !== 0 ) {
    return false;
  }

  const legacyDeltaY = ( event as WheelEvent & { wheelDeltaY?: number } ).wheelDeltaY;

  if ( typeof legacyDeltaY === "number" && legacyDeltaY !== 0 ) {
    return Math.abs( legacyDeltaY + 3 * event.deltaY ) > 1.5;
  }

  return false;
}

interface UseViewportGesturesProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  transform: React.MutableRefObject<TransformState>;
  setTransform: (
    values: Partial<TransformState>,
    contentElement: HTMLDivElement | null
  ) => void;
  cancelAnimation: () => void;
  disableTouchGestures?: boolean;
  // Freeze every pan/pinch/wheel gesture (used while a browser recording
  // owns the engine clock — panning would otherwise pause the engine and
  // desync the capture).
  lockInteractions?: boolean;
  onInteractionStart?: ( mode: "panning" | "zooming" ) => void;
  onInteractionEnd?: () => void;
}

// True when the gesture originates from a touchscreen (finger on the canvas),
// as opposed to a mouse drag or a trackpad wheel/pinch.
function isTouchGesture( event: Event | undefined ): boolean {
  if ( !event ) {
    return false;
  }

  if ( "pointerType" in event ) {
    return ( event as PointerEvent ).pointerType === "touch";
  }

  return event.type.startsWith( "touch" );
}

export function useViewportGestures( {
  containerRef,
  contentRef,
  transform,
  setTransform,
  cancelAnimation,
  disableTouchGestures = false,
  lockInteractions = false,
  onInteractionStart,
  onInteractionEnd
}: UseViewportGesturesProps ) {
  // What the current wheel burst does, decided by its first plain event and
  // kept until the wheel recogniser's end, so a scroll never flips between
  // panning and zooming halfway; ctrl+wheel (pinch) events never set it.
  const wheelMode = useRef<"pan" | "zoom" | null>( null );

  useGesture(
    {
      onDragStart: ( {
        event, cancel
      } ) => {
        if ( ( event?.target as Element )?.closest?.( "[data-no-drag]" ) ) {
          cancel();
          return;
        }

        // Fingers belong to the sketch (touch interaction source) — leave
        // panning to the mouse / zoom controls so touching never moves the
        // canvas nor pauses the loop.
        if ( disableTouchGestures && isTouchGesture( event ) ) {
          cancel();
          return;
        }

        cancelAnimation();
        onInteractionStart?.( "panning" );
      },
      onDragEnd: () => onInteractionEnd?.(),
      onPinchStart: ( {
        event, cancel
      } ) => {
        if ( disableTouchGestures && isTouchGesture( event ) ) {
          cancel();
          return;
        }

        cancelAnimation();
        onInteractionStart?.( "zooming" );
      },
      onPinchEnd: () => onInteractionEnd?.(),
      // The wheel recogniser also sees the pinch's ctrl+wheel events, so the
      // interaction is opened lazily by the first *plain* wheel event in
      // `onWheel` (below) rather than here, and closed only if it was opened.
      onWheelEnd: () => {
        if ( !wheelMode.current ) {
          return;
        }

        wheelMode.current = null;
        onInteractionEnd?.();
      },

      // One-finger Drag (Pan)
      onDrag: ( {
        delta: [
          deltaX,
          deltaY
        ],
        canceled
      } ) => {
        if ( canceled ) {
          return;
        }

        const {
          x, y
        } = transform.current;

        setTransform(
          {
            x: x + deltaX,
            y: y + deltaY
          },
          contentRef.current
        );
      },

      // Two-finger Pinch (Zoom + Pan)
      onPinch: ( {
        event,
        origin: [
          originX,
          originY
        ],
        offset: [
          scale
        ],
        first,
        memo,
        canceled
      } ) => {
        const container = containerRef.current;

        if ( !container || canceled || ( disableTouchGestures && isTouchGesture( event ) ) ) {
          return;
        }

        const rect = container.getBoundingClientRect();

        // Calculate the center of the gesture relative to the container
        const currentGestureX = originX - rect.left;
        const currentGestureY = originY - rect.top;

        if ( first ) {
          const {
            x, y, scale
          } = transform.current;

          // Store the state at the VERY MOMENT the pinch starts
          return {
            initialScale: scale,
            initialX: x,
            initialY: y,
            // Store where the fingers were relative to container at start
            initialGestureX: currentGestureX,
            initialGestureY: currentGestureY
          };
        }

        // Retrieve initial state
        const {
          initialScale,
          initialX,
          initialY,
          initialGestureX,
          initialGestureY
        } = memo;

        // LOGIC:
        // We want the point on the image that was under the fingers at start (initialGesture)
        // to move to where the fingers are NOW (currentGesture), considering the new scale.
        //
        // Formula:
        // NewTranslate = CurrentGesture - ( (InitialGesture - InitialTranslate) / InitialScale ) * NewScale

        const newScale = scale;

        const newX =
          currentGestureX -
          ( ( initialGestureX - initialX ) / initialScale ) * newScale;
        const newY =
          currentGestureY -
          ( ( initialGestureY - initialY ) / initialScale ) * newScale;

        setTransform(
          {
            x: newX,
            y: newY,
            scale: newScale
          },
          contentRef.current
        );

        return memo;
      },

      // Mouse wheel = Zoom about the cursor; two-finger trackpad scroll = Pan
      // (`isMouseWheelEvent`). A pinch — touch, or ctrl+wheel, which is what a
      // trackpad pinch and a mouse ctrl+scroll both arrive as — is `onPinch`'s.
      onWheel: ( {
        event, delta: [
          deltaX,
          deltaY
        ]
      } ) => {
        if ( isPinchWheelEvent( event ) ) {
          return;
        }

        event.preventDefault();

        if ( !wheelMode.current ) {
          wheelMode.current = isMouseWheelEvent( event ) ? "zoom" : "pan";
          cancelAnimation();
          onInteractionStart?.( wheelMode.current === "zoom" ? "zooming" : "panning" );
        }

        if ( wheelMode.current === "zoom" ) {
          const container = containerRef.current;

          if ( !container ) {
            return;
          }

          setTransform(
            calculateZoomTarget(
              transform.current.scale * Math.exp( -deltaY * WHEEL_ZOOM_PER_PIXEL ),
              event.clientX,
              event.clientY,
              container.getBoundingClientRect(),
              transform.current
            ),
            contentRef.current
          );

          return;
        }

        const {
          x, y
        } = transform.current;

        // Natural scrolling: the content follows the fingers, so a positive
        // delta (scroll down / right) moves it up / left.
        setTransform(
          {
            x: x - deltaX,
            y: y - deltaY
          },
          contentRef.current
        );
      }
    },
    {
      target: containerRef,
      // Disabling at the shared-config level tears down every gesture
      // recogniser, so no drag/pinch/wheel can fire while locked.
      enabled: !lockInteractions,
      drag: {
        from: () => [
          transform.current.x,
          transform.current.y
        ],
        filterTaps: true
      },
      pinch: {
        scaleBounds: {
          min: MIN_SCALE,
          max: MAX_SCALE
        },
        // Explicit so a wheel-driven pinch is keyed on the same modifier the
        // wheel handler filters on.
        modifierKey: PINCH_WHEEL_MODIFIER,
        from: () => [
          transform.current.scale,
          0
        ]
      },
      wheel: {
        eventOptions: {
          passive: false
        },
        from: () => [
          transform.current.x,
          transform.current.y
        ]
      }
    }
  );
}
