"use client";

import {
  useRef, type KeyboardEvent, type PointerEvent
} from "react";

import clamp from "@/utils/clamp";

type Options = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: ( value: number ) => void;
};

// Movement (px) before a touch gesture locks to horizontal (adjust the value)
// or vertical (let the panel scroll).
const DIRECTION_LOCK_THRESHOLD = 6;

/**
 * Pointer handling for a horizontal value bar that shares its touch surface
 * with a vertically scrolling panel (the mobile studio drawer).
 *
 * On touch we defer until the gesture's direction is clear: a mostly-horizontal
 * drag adjusts the value, a mostly-vertical drag is left untouched so the panel
 * scrolls. The value is never committed on the initial touch, so trying to
 * scroll with a finger that happens to land on the bar doesn't jump it. The
 * element must carry `touch-action: pan-y` so the browser keeps owning vertical
 * pans. Mouse / pen keep the classic click-anywhere-then-drag behaviour.
 */
export default function useDragSlider( {
  min,
  max,
  step,
  value,
  onChange
}: Options ) {
  const ref = useRef<HTMLDivElement>( null );
  const gesture = useRef<{
    pointerId: number;
    mode: "pending" | "dragging" | "scrolling";
    startX: number;
    startY: number;
  } | null>( null );

  const stepDecimals = ( () => {
    const text = String( step );
    const dot = text.indexOf( "." );

    return dot === -1 ? 0 : text.length - dot - 1;
  } )();

  const valueFromClientX = ( clientX: number ): number => {
    const element = ref.current;

    if ( !element ) {
      return value;
    }

    const rect = element.getBoundingClientRect();
    const fraction =
      rect.width > 0 ? clamp(
        ( clientX - rect.left ) / rect.width,
        0,
        1
      ) : 0;
    const snapped = Math.round( ( min + fraction * ( max - min ) ) / step ) * step;

    return clamp(
      Number( snapped.toFixed( stepDecimals ) ),
      min,
      max
    );
  };

  const onPointerDown = ( event: PointerEvent<HTMLDivElement> ) => {
    if ( event.pointerType === "touch" ) {
      // Wait for the first move to tell a scroll from an adjust.
      gesture.current = {
        pointerId: event.pointerId,
        mode: "pending",
        startX: event.clientX,
        startY: event.clientY
      };

      return;
    }

    // Mouse / pen: classic immediate slide.
    gesture.current = {
      pointerId: event.pointerId,
      mode: "dragging",
      startX: event.clientX,
      startY: event.clientY
    };
    ref.current?.setPointerCapture( event.pointerId );
    onChange( valueFromClientX( event.clientX ) );
  };

  const onPointerMove = ( event: PointerEvent<HTMLDivElement> ) => {
    const state = gesture.current;

    if ( !state || state.pointerId !== event.pointerId ) {
      return;
    }

    if ( state.mode === "pending" ) {
      const dx = Math.abs( event.clientX - state.startX );
      const dy = Math.abs( event.clientY - state.startY );

      if ( dx < DIRECTION_LOCK_THRESHOLD && dy < DIRECTION_LOCK_THRESHOLD ) {
        return;
      }

      if ( dx >= dy ) {
        state.mode = "dragging";
        ref.current?.setPointerCapture( event.pointerId );
        onChange( valueFromClientX( event.clientX ) );
      } else {
        // Vertical intent: hand the gesture back to the page for scrolling.
        state.mode = "scrolling";
      }

      return;
    }

    if ( state.mode === "dragging" ) {
      onChange( valueFromClientX( event.clientX ) );
    }
  };

  const finish = ( event: PointerEvent<HTMLDivElement> ) => {
    const state = gesture.current;

    if ( !state || state.pointerId !== event.pointerId ) {
      return;
    }

    // A tap (no committed direction) sets the value at the touch point, keeping
    // the familiar tap-to-set affordance — but only on a real pointerup, never
    // on the pointercancel the browser fires when it takes over for scrolling.
    if ( state.mode === "pending" && event.type === "pointerup" ) {
      onChange( valueFromClientX( event.clientX ) );
    }

    if ( ref.current?.hasPointerCapture( event.pointerId ) ) {
      ref.current.releasePointerCapture( event.pointerId );
    }

    gesture.current = null;
  };

  const onKeyDown = ( event: KeyboardEvent<HTMLDivElement> ) => {
    let next: number | null = null;

    if ( event.key === "ArrowLeft" || event.key === "ArrowDown" ) {
      next = value - step;
    } else if ( event.key === "ArrowRight" || event.key === "ArrowUp" ) {
      next = value + step;
    } else if ( event.key === "Home" ) {
      next = min;
    } else if ( event.key === "End" ) {
      next = max;
    }

    if ( next === null ) {
      return;
    }

    event.preventDefault();
    onChange( clamp(
      Number( ( Math.round( next / step ) * step ).toFixed( stepDecimals ) ),
      min,
      max
    ) );
  };

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onKeyDown
    }
  };
}
