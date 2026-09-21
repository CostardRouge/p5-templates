"use client";

import {
  useRef
} from "react";

import {
  fromSpherical,
  length3,
  normalize3,
  rotateBetween,
  scale3,
  toDegrees,
  toSpherical,
  trackballPoint,
  type Vector3DValue
} from "../utils/vector3dMath";
import {
  AXIS_LABEL_CLASS,
  VIEW_FRAME_CLASS,
  nudgeFromKey,
  pointerFraction,
  type ViewProps
} from "./shared";

type Session = {
  /** What the drag started from — restored by Escape. */
  start: Vector3DValue;
  /** The unsnapped vector the drag rotates, so per-step snapping never drifts its length. */
  vector: Vector3DValue;
  /** Last trackball point the pointer was lifted to. */
  point: Vector3DValue;
};

/**
 * A virtual trackball, seen straight down +z: the disc is the unit sphere,
 * the dot is where the vector pierces it (solid on the near hemisphere,
 * hollow on the far one). Dragging rotates the vector about the origin the
 * way Blender's direction sphere and every arcball do — it never jumps to
 * the pointer, and it keeps turning past the rim onto the far side. Ctrl
 * snaps the direction to 45° (Ctrl+Shift: 15°), Escape cancels the drag —
 * both Blender's `UNITVEC` conventions. The strip below sets the length.
 * Best for a light, a normal, an axis: anything that is a direction first and
 * a magnitude second.
 */
export default function OrbitView( {
  current, axes, yDown, kind, commit, ariaLabel
}: ViewProps ) {
  const discRef = useRef<HTMLDivElement>( null );
  const stripRef = useRef<HTMLDivElement>( null );
  const sessionRef = useRef<Session | null>( null );

  // The longest vector the box can hold along an axis — the strip's full scale.
  const maxLength = Math.max(
    Math.abs( axes.xAxis.min ),
    Math.abs( axes.xAxis.max ),
    Math.abs( axes.yAxis.min ),
    Math.abs( axes.yAxis.max ),
    Math.abs( axes.zAxis.min ),
    Math.abs( axes.zAxis.max ),
    1e-9
  );

  const length = length3( current );
  const direction = normalize3( current );
  const spherical = toSpherical( current );

  // Disc coordinates: x right, y up unless the canvas' y points down.
  const discPoint = ( event: React.PointerEvent<HTMLDivElement> ) => {
    const {
      fx, fy
    } = pointerFraction(
      event,
      event.currentTarget
    );
    const sx = fx * 2 - 1;
    const sy = ( yDown ? fy : 1 - fy ) * 2 - 1;

    return trackballPoint(
      sx,
      sy
    );
  };

  const handleDiscPointerDown = ( event: React.PointerEvent<HTMLDivElement> ) => {
    event.currentTarget.setPointerCapture( event.pointerId );
    event.currentTarget.focus();

    sessionRef.current = {
      start: current,
      // A zero vector has no direction to turn: start it at unit length
      // toward the viewer so the first drag does something visible.
      vector: length > 1e-9 ? current : {
        x: 0,
        y: 0,
        z: Math.min(
          1,
          maxLength
        )
      },
      point: discPoint( event )
    };
  };

  const handleDiscPointerMove = ( event: React.PointerEvent<HTMLDivElement> ) => {
    const session = sessionRef.current;

    if ( !session || !event.currentTarget.hasPointerCapture( event.pointerId ) ) {
      return;
    }

    const point = discPoint( event );
    const vector = rotateBetween(
      session.vector,
      session.point,
      point
    );

    sessionRef.current = {
      ...session,
      vector,
      point
    };

    if ( event.ctrlKey ) {
      const step = event.shiftKey ? Math.PI / 12 : Math.PI / 4;
      const spherical = toSpherical( vector );

      commit( fromSpherical( {
        azimuth: Math.round( spherical.azimuth / step ) * step,
        elevation: Math.round( spherical.elevation / step ) * step,
        length: spherical.length
      } ) );

      return;
    }

    commit( vector );
  };

  const handleDiscPointerUp = () => {
    sessionRef.current = null;
  };

  const updateStrip = ( event: React.PointerEvent<HTMLDivElement> ) => {
    const {
      fx
    } = pointerFraction(
      event,
      event.currentTarget
    );
    const nextLength = Math.min(
      Math.max(
        fx,
        0
      ),
      1
    ) * maxLength;

    commit( scale3(
      direction,
      nextLength
    ) );
  };

  const handleKeyDown = ( event: React.KeyboardEvent<HTMLDivElement> ) => {
    if ( event.key === "Escape" && sessionRef.current ) {
      // Cancel the drag: restore what it started from and swallow the key so
      // the page's own Escape (presentation mode) does not fire on top.
      event.preventDefault();
      event.stopPropagation();
      commit( sessionRef.current.start );
      sessionRef.current = null;

      return;
    }

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

  const dotLeft = ( direction.x + 1 ) * 50;
  const dotTop = ( ( yDown ? direction.y : -direction.y ) + 1 ) * 50;
  const front = direction.z >= 0;
  const lengthLeft = Math.min(
    length / maxLength,
    1
  ) * 100;

  return (
    <div className="flex w-full flex-col gap-1">
      <div
        ref={ discRef }
        role="application"
        tabIndex={ 0 }
        aria-label={ `${ ariaLabel } direction sphere` }
        onPointerDown={ handleDiscPointerDown }
        onPointerMove={ handleDiscPointerMove }
        onPointerUp={ handleDiscPointerUp }
        onPointerCancel={ handleDiscPointerUp }
        onKeyDown={ handleKeyDown }
        className={ `${ VIEW_FRAME_CLASS } aspect-square w-full cursor-grab active:cursor-grabbing` }
        title="Drag to turn the direction · Ctrl: snap to 45° (Ctrl+Shift: 15°) · Esc cancels"
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          {/* The sphere's silhouette, its equator (the x·z plane, edge-on) and
              its prime meridian. */}
          <circle
            cx="50"
            cy="50"
            r="48"
            className="fill-none stroke-theme/60"
            strokeWidth={ 0.75 }
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="2"
            y1="50"
            x2="98"
            y2="50"
            className="stroke-theme/40"
            strokeWidth={ 0.5 }
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="50"
            y1="2"
            x2="50"
            y2="98"
            className="stroke-theme/40"
            strokeWidth={ 0.5 }
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
          {/* A hint of the sphere's curvature: the latitude ring the dot sits on. */}
          <ellipse
            cx="50"
            cy="50"
            rx={ 48 }
            ry={ Math.abs( 48 * ( yDown ? direction.y : direction.y ) ) }
            className="fill-none stroke-theme/30"
            strokeWidth={ 0.5 }
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={ 50 }
            y1={ 50 }
            x2={ dotLeft }
            y2={ dotTop }
            className="stroke-foreground/60"
            strokeWidth={ 1 }
            strokeDasharray={ front ? undefined : "2 2" }
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className={ `${ AXIS_LABEL_CLASS } right-0.5 top-1/2 -translate-y-1/2` }>x</span>
        <span className={ `${ AXIS_LABEL_CLASS } left-1/2 -translate-x-1/2 ${ yDown ? "bottom-0.5" : "top-0.5" }` }>y</span>
        <span className={ `${ AXIS_LABEL_CLASS } left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2` }>z</span>
        <span className={ `${ AXIS_LABEL_CLASS } bottom-0.5 left-0.5 tabular-nums` }>
          {`az ${ toDegrees( spherical.azimuth ) }° · el ${ toDegrees( spherical.elevation ) }°`}
        </span>
        <span
          className={ `pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow ${
            front
              ? "border-background bg-foreground"
              : "border-foreground bg-background"
          }` }
          style={ {
            left: `${ dotLeft }%`,
            top: `${ dotTop }%`
          } }
          title={ front ? "near side" : "far side" }
        />
      </div>

      <div
        ref={ stripRef }
        role="slider"
        tabIndex={ 0 }
        aria-label={ `${ ariaLabel } length` }
        aria-valuemin={ 0 }
        aria-valuemax={ maxLength }
        aria-valuenow={ Number( length.toFixed( 3 ) ) }
        onPointerDown={ ( event ) => {
          event.currentTarget.setPointerCapture( event.pointerId );
          updateStrip( event );
        } }
        onPointerMove={ ( event ) =>
          event.currentTarget.hasPointerCapture( event.pointerId ) && updateStrip( event ) }
        className={ `${ VIEW_FRAME_CLASS } h-4 w-full cursor-ew-resize` }
        title={ kind === "direction" ? "Length (1 = unit direction)" : "Distance from the origin" }
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1="50"
            x2={ lengthLeft }
            y2="50"
            className="stroke-foreground/60"
            strokeWidth={ 1 }
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className={ `${ AXIS_LABEL_CLASS } right-0.5 top-1/2 -translate-y-1/2 tabular-nums` }>
          {`|v| ${ length.toFixed( 2 ) }`}
        </span>
        <span
          className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-foreground shadow"
          style={ {
            left: `${ lengthLeft }%`
          } }
        />
      </div>
    </div>
  );
}
