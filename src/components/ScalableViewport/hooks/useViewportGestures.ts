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
  MAX_SCALE
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
  // True between the first plain wheel event of a scroll and the wheel
  // recogniser's end; ctrl+wheel (pinch) events never open it.
  const wheelPanActive = useRef( false );

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
      // pan interaction is opened lazily by the first *plain* wheel event in
      // `onWheel` (below) rather than here, and closed only if it was opened.
      onWheelEnd: () => {
        if ( !wheelPanActive.current ) {
          return;
        }

        wheelPanActive.current = false;
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

      // Wheel / two-finger trackpad scroll = Pan. Zoom is the pinch's job
      // (touch pinch, or ctrl+wheel — what a trackpad pinch and a mouse
      // ctrl+scroll both arrive as), handled by `onPinch` above.
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

        if ( !wheelPanActive.current ) {
          wheelPanActive.current = true;
          cancelAnimation();
          onInteractionStart?.( "panning" );
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
