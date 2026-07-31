"use client";

import {
  useEffect, useRef, type KeyboardEvent, type PointerEvent
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
 *
 * A drag emits at most one `onChange` per animation frame, and never re-emits a
 * value the bar already holds. Pointer moves arrive far faster than the options
 * form can consume them — a single change fans out through react-hook-form,
 * every field watching it, and the sketch bridge — so calling `onChange` from
 * each move buries the main thread in redundant renders and lets React's
 * nested-update guard ("Maximum update depth exceeded") trip on a chain of
 * updates scheduled straight from the event handler. Coalescing keeps the drag
 * to one update per painted frame; the trailing value is flushed on pointer-up
 * so the gesture always lands where the finger left it.
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

  // Latest value the gesture produced but hasn't handed to `onChange` yet, and
  // the frame scheduled to do so.
  const pending = useRef<number | null>( null );
  const frame = useRef<number | null>( null );
  // Last value this gesture emitted — the baseline for skipping no-op changes.
  // Null between gestures, where the `value` prop is the baseline instead.
  const emitted = useRef<number | null>( null );

  // A drag can outlive the slider (collapsing the panel mid-gesture), so drop
  // any frame still owed on unmount.
  useEffect(
    () => () => {
      if ( frame.current !== null ) {
        cancelAnimationFrame( frame.current );
        frame.current = null;
      }
    },
    []
  );

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

  const commit = ( next: number ) => {
    if ( next === ( emitted.current ?? value ) ) {
      return;
    }

    emitted.current = next;
    onChange( next );
  };

  const flushPending = () => {
    if ( frame.current !== null ) {
      cancelAnimationFrame( frame.current );
      frame.current = null;
    }

    const next = pending.current;

    pending.current = null;

    if ( next !== null ) {
      commit( next );
    }
  };

  // Hold the value until the next frame, so a burst of moves costs one update.
  const scheduleCommit = ( clientX: number ) => {
    pending.current = valueFromClientX( clientX );

    if ( frame.current !== null ) {
      return;
    }

    frame.current = requestAnimationFrame( () => {
      frame.current = null;
      flushPending();
    } );
  };

  const onPointerDown = ( event: PointerEvent<HTMLDivElement> ) => {
    emitted.current = null;
    pending.current = null;

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
    commit( valueFromClientX( event.clientX ) );
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
        scheduleCommit( event.clientX );
      } else {
        // Vertical intent: hand the gesture back to the page for scrolling.
        state.mode = "scrolling";
      }

      return;
    }

    if ( state.mode === "dragging" ) {
      scheduleCommit( event.clientX );
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
    if ( state.mode === "pending" ) {
      if ( event.type === "pointerup" ) {
        commit( valueFromClientX( event.clientX ) );
      }
    } else {
      // Land the value the last move produced, whether or not its frame ran.
      flushPending();
    }

    if ( ref.current?.hasPointerCapture( event.pointerId ) ) {
      ref.current.releasePointerCapture( event.pointerId );
    }

    gesture.current = null;
    emitted.current = null;
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
