"use client";

import {
  useDrag
} from "@use-gesture/react";
import clsx from "clsx";
import {
  ReactNode, useEffect, useRef, useState
} from "react";

export type SheetSnap = "peek" | "half" | "full";

type MobileSheetProps = {
  /** Controlled snap point. Omit for uncontrolled. */
  snap?: SheetSnap;
  /** Fires when the user drags or taps to a new snap point. */
  onSnapChange?: ( snap: SheetSnap ) => void;
  /** Initial snap for uncontrolled mode. */
  defaultSnap?: SheetSnap;
  /** Always-visible bar below the drag handle (e.g. play/pause, record). */
  peekBar?: ReactNode;
  /** Sticky row shown when sheet is `half` or `full` (e.g. tab bar). */
  tabBar?: ReactNode;
  /** Scrollable body shown when sheet is `half` or `full`. */
  children: ReactNode;
  className?: string;
};

const PEEK_PX = 64;
const HALF_VH = 55;
const FULL_VH = 92;

const SNAP_ORDER: SheetSnap[] = [
  "peek",
  "half",
  "full"
];

// Pixel thresholds used to decide whether a drag becomes a snap change.
const DRAG_COMMIT_PX = 48;
const FLICK_VELOCITY = 0.5;

export default function MobileSheet( {
  snap: controlledSnap,
  onSnapChange,
  defaultSnap = "peek",
  peekBar,
  tabBar,
  children,
  className
}: MobileSheetProps ) {
  const [
    internalSnap,
    setInternalSnap
  ] = useState<SheetSnap>( defaultSnap );

  const isControlled = controlledSnap !== undefined;
  const snap = isControlled ? controlledSnap : internalSnap;

  const setSnap = ( next: SheetSnap ) => {
    if ( isControlled ) {
      onSnapChange?.( next );
    } else {
      setInternalSnap( next );

      if ( onSnapChange ) {
        onSnapChange( next );
      }
    }
  };

  // Honor reduced-motion: skip enter/snap transition for users who request it.
  const [
    prefersReducedMotion,
    setPrefersReducedMotion
  ] = useState( false );

  useEffect(
    () => {
      const mq = window.matchMedia( "(prefers-reduced-motion: reduce)" );

      setPrefersReducedMotion( mq.matches );

      const handler = ( e: MediaQueryListEvent ) => setPrefersReducedMotion( e.matches );

      mq.addEventListener(
        "change",
        handler
      );

      return () => mq.removeEventListener(
        "change",
        handler
      );
    },
    []
  );

  // Drag state for the handle. `dragOffset` is a transient offset applied
  // during a drag; on release we commit to a new snap and reset to 0.
  const [
    dragOffset,
    setDragOffset
  ] = useState( 0 );
  const startSnapRef = useRef<SheetSnap>( snap );

  const bindHandle = useDrag(
    ( {
      first, last, tap, movement: [
        , my
      ], velocity: [
        , vy
      ], direction: [
        , dy
      ]
    } ) => {
      if ( first ) {
        startSnapRef.current = snap;
      }

      if ( !last ) {
        setDragOffset( my );

        return;
      }

      setDragOffset( 0 );

      if ( tap ) {
        // Tap on handle: cycle through snap points.
        const next = SNAP_ORDER[ ( SNAP_ORDER.indexOf( startSnapRef.current ) + 1 ) % SNAP_ORDER.length ];

        setSnap( next );

        return;
      }

      const flick = vy > FLICK_VELOCITY;
      const idx = SNAP_ORDER.indexOf( startSnapRef.current );

      if ( my < -DRAG_COMMIT_PX || ( flick && dy < 0 ) ) {
        setSnap( SNAP_ORDER[ Math.min(
          SNAP_ORDER.length - 1,
          idx + 1
        ) ] );
      } else if ( my > DRAG_COMMIT_PX || ( flick && dy > 0 ) ) {
        setSnap( SNAP_ORDER[ Math.max(
          0,
          idx - 1
        ) ] );
      }
    },
    {
      axis: "y",
      filterTaps: true,
      from: () => [
        0,
        0
      ]
    }
  );

  const height = snap === "peek"
    ? `${ PEEK_PX }px`
    : snap === "half"
      ? `${ HALF_VH }svh`
      : `${ FULL_VH }svh`;

  const expanded = snap !== "peek";

  return (
    <div
      className={ clsx(
        "fixed inset-x-0 bottom-0 z-40 glass border-t border-theme shadow-2xl rounded-t-2xl flex flex-col",
        className
      ) }
      style={ {
        height,
        transform: dragOffset !== 0 ? `translateY(${ Math.max(
          -200,
          Math.min(
            200,
            dragOffset
          )
        ) }px)` : undefined,
        transition: dragOffset !== 0 || prefersReducedMotion
          ? "none"
          : "height 250ms ease-out, transform 200ms ease-out",
        paddingBottom: "env(safe-area-inset-bottom)"
      } }
      role="dialog"
      aria-label="Sketch options"
    >
      {/* Drag handle (tap to cycle, drag vertically to snap) */}
      <div
        { ...bindHandle() }
        className="flex flex-col items-center justify-center pt-2 pb-1 select-none touch-none cursor-grab active:cursor-grabbing"
        style={ {
          touchAction: "none"
        } }
        aria-label={
          expanded
            ? "Sheet handle. Tap to expand more, drag down to collapse."
            : "Sheet handle. Tap or drag up to expand."
        }
        role="button"
      >
        <div className="w-10 h-1.5 rounded-full bg-foreground/30" />
      </div>

      {/* Peek bar: always visible */}
      {peekBar && (
        <div className="flex items-center gap-2 px-3 pb-2 shrink-0">
          {peekBar}
        </div>
      )}

      {/* Expanded content */}
      <div
        className={ clsx(
          "flex flex-col flex-1 min-h-0 overflow-hidden transition-opacity duration-150",
          expanded ? "opacity-100" : "opacity-0 pointer-events-none"
        ) }
        aria-hidden={ !expanded }
      >
        {tabBar && (
          <div className="shrink-0 border-t border-theme/40 px-2 pt-1">
            {tabBar}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
          {children}
        </div>
      </div>
    </div>
  );
}
