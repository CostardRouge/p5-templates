"use client";

import {
  useRef
} from "react";

import {
  fractionToValue,
  valueToFraction
} from "../utils/vector3dMath";
import {
  AXIS_LABEL_CLASS,
  VIEW_FRAME_CLASS,
  nudgeFromKey,
  pointerFraction,
  type ViewProps
} from "./shared";

/**
 * The 2D pad for x·y with a vertical strip for z beside it — the shape
 * Tweakpane's `point3d` and most "XY pad + fader" panels use. Nothing to
 * learn if the 2D pad is familiar, and every coordinate is reachable in one
 * gesture; the price is that depth reads as a fader position, not as depth.
 */
export default function PadDepthView( {
  current, axes, yDown, commit, ariaLabel
}: ViewProps ) {
  const padRef = useRef<HTMLDivElement>( null );
  const stripRef = useRef<HTMLDivElement>( null );

  const fractionY = ( y: number ) => {
    const fraction = valueToFraction(
      y,
      axes.yAxis
    );

    return yDown ? fraction : 1 - fraction;
  };

  const updatePad = ( event: React.PointerEvent<HTMLDivElement> ) => {
    const pad = padRef.current;

    if ( !pad ) {
      return;
    }

    const {
      fx, fy
    } = pointerFraction(
      event,
      pad
    );

    commit( {
      ...current,
      x: fractionToValue(
        fx,
        axes.xAxis
      ),
      y: fractionToValue(
        yDown ? fy : 1 - fy,
        axes.yAxis
      )
    } );
  };

  const updateStrip = ( event: React.PointerEvent<HTMLDivElement> ) => {
    const strip = stripRef.current;

    if ( !strip ) {
      return;
    }

    const {
      fy
    } = pointerFraction(
      event,
      strip
    );

    commit( {
      ...current,
      z: fractionToValue(
        1 - fy,
        axes.zAxis
      )
    } );
  };

  const capture = ( event: React.PointerEvent<HTMLDivElement> ) => {
    event.currentTarget.setPointerCapture( event.pointerId );
    event.currentTarget.focus();
  };

  const captured = ( event: React.PointerEvent<HTMLDivElement> ) =>
    event.currentTarget.hasPointerCapture( event.pointerId );

  const handleKeyDown = ( event: React.KeyboardEvent<HTMLDivElement> ) => {
    const next = nudgeFromKey(
      event,
      current,
      axes,
      yDown
    );

    if ( next ) {
      event.preventDefault();
      commit( next );
    }
  };

  const pointLeft = valueToFraction(
    current.x,
    axes.xAxis
  ) * 100;
  const pointTop = fractionY( current.y ) * 100;
  const depthTop = ( 1 - valueToFraction(
    current.z,
    axes.zAxis
  ) ) * 100;

  return (
    <div className="flex w-full items-stretch gap-1">
      <div
        ref={ padRef }
        role="application"
        tabIndex={ 0 }
        aria-label={ `${ ariaLabel } x·y pad` }
        onPointerDown={ ( event ) => {
          capture( event );
          updatePad( event );
        } }
        onPointerMove={ ( event ) => captured( event ) && updatePad( event ) }
        onKeyDown={ handleKeyDown }
        className={ `${ VIEW_FRAME_CLASS } aspect-square min-w-0 flex-1 cursor-crosshair` }
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1="50"
            y1="0"
            x2="50"
            y2="100"
            className="stroke-theme/40"
            strokeWidth={ 0.5 }
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            className="stroke-theme/40"
            strokeWidth={ 0.5 }
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={ 50 }
            y1={ 50 }
            x2={ pointLeft }
            y2={ pointTop }
            className="stroke-foreground/60"
            strokeWidth={ 1 }
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className={ `${ AXIS_LABEL_CLASS } right-0.5 top-1/2 -translate-y-1/2` }>x</span>
        <span className={ `${ AXIS_LABEL_CLASS } left-1/2 top-0.5 -translate-x-1/2` }>y</span>
        <span
          className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-foreground shadow"
          style={ {
            left: `${ pointLeft }%`,
            top: `${ pointTop }%`
          } }
        />
      </div>

      <div
        ref={ stripRef }
        role="slider"
        tabIndex={ 0 }
        aria-label={ `${ ariaLabel } z` }
        aria-valuemin={ axes.zAxis.min }
        aria-valuemax={ axes.zAxis.max }
        aria-valuenow={ current.z }
        aria-orientation="vertical"
        onPointerDown={ ( event ) => {
          capture( event );
          updateStrip( event );
        } }
        onPointerMove={ ( event ) => captured( event ) && updateStrip( event ) }
        onKeyDown={ handleKeyDown }
        className={ `${ VIEW_FRAME_CLASS } w-5 shrink-0 cursor-ns-resize` }
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1="50"
            y1="0"
            x2="50"
            y2="100"
            className="stroke-theme/40"
            strokeWidth={ 0.5 }
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2={ depthTop }
            className="stroke-foreground/60"
            strokeWidth={ 1 }
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className={ `${ AXIS_LABEL_CLASS } left-1/2 top-0.5 -translate-x-1/2` }>z</span>
        <span
          className="pointer-events-none absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-foreground shadow"
          style={ {
            top: `${ depthTop }%`
          } }
        />
      </div>
    </div>
  );
}
