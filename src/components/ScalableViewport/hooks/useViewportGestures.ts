import {
  useGesture
} from "@use-gesture/react";
import type {
  TransformState
} from "./useTransformState";
import {
  calculateZoomTarget,
  MIN_SCALE,
  MAX_SCALE,
} from "../utils/zoomCalculations";

interface UseViewportGesturesProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  transform: React.MutableRefObject<TransformState>;
  setTransform: (
    values: Partial<TransformState>,
    contentElement: HTMLDivElement | null
  ) => void;
  cancelAnimation: () => void;
}

export function useViewportGestures( {
  containerRef,
  contentRef,
  transform,
  setTransform,
  cancelAnimation,
}: UseViewportGesturesProps ) {
  useGesture(
    {
      onDragStart: ( { event, cancel } ) => {
        if ( ( event?.target as Element )?.closest?.( "[data-no-drag]" ) ) {
          cancel();
          return;
        }

        cancelAnimation();
      },
      onPinchStart: () => cancelAnimation(),
      onWheelStart: () => cancelAnimation(),

      // One-finger Drag (Pan)
      onDrag: ( {
        delta: [
          deltaX,
          deltaY
        ],
        canceled,
      } ) => {
        if ( canceled ) return;

        const {
          x, y
        } = transform.current;

        setTransform(
          {
            x: x + deltaX,
            y: y + deltaY,
          },
          contentRef.current
        );
      },

      // Two-finger Pinch (Zoom + Pan)
      onPinch: ( {
        origin: [
          originX,
          originY
        ],
        offset: [
          scale
        ],
        first,
        memo,
      } ) => {
        const container = containerRef.current;

        if ( !container ) return;

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
            initialGestureY: currentGestureY,
          };
        }

        // Retrieve initial state
        const {
          initialScale,
          initialX,
          initialY,
          initialGestureX,
          initialGestureY,
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
            scale: newScale,
          },
          contentRef.current
        );

        return memo;
      },

      // Wheel / Trackpad Pan
      onWheel: ( {
        event, delta: [
          deltaX,
          deltaY
        ]
      } ) => {
        const container = containerRef.current;

        if ( !container ) return;

        // Standard Wheel = Zoom
        event.preventDefault();
        const {
          scale
        } = transform.current;
        const zoomFactor = Math.exp( -deltaY * 0.01 );
        const rect = container.getBoundingClientRect();
        const target = calculateZoomTarget(
          scale * zoomFactor,
          event.clientX,
          event.clientY,
          rect,
          transform.current
        );

        setTransform(
          target,
          contentRef.current
        );
      },
    },
    {
      target: containerRef,
      drag: {
        from: () => [
          transform.current.x,
          transform.current.y
        ],
        filterTaps: true,
      },
      pinch: {
        scaleBounds: {
          min: MIN_SCALE,
          max: MAX_SCALE,
        },
        from: () => [
          transform.current.scale,
          0
        ],
      },
      wheel: {
        eventOptions: {
          passive: false,
        },
        from: () => [
          transform.current.x,
          transform.current.y
        ],
      },
    }
  );
}
