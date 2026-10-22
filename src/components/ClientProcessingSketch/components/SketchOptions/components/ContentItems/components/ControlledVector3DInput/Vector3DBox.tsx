"use client";

import clamp from "@/utils/clamp";
import clsx from "clsx";
import {
  useLayoutEffect, useRef, useState
} from "react";

import {
  type BindingValue, getBindingValues, subscribeBindingValues
} from "@/lib/channelBridge";
import LiveBindingValue from "../BindingAffordance/LiveBindingValue";

import {
  DEFAULT_VIEW,
  UNIT_AXES,
  add3,
  axisDragAmount,
  fromCube,
  projectPoint,
  scale3,
  snapToAxis,
  toCube,
  unprojectScreenDelta,
  viewDepthAxis,
  type Axes3D,
  type AxisName,
  type Vector3DKind,
  type Vector3DValue,
  type ViewOrientation
} from "./utils/vector3dMath";

type Props = {
  /** Complete, snapped value — what the form holds. */
  current: Vector3DValue;
  axes: Axes3D;
  yDown: boolean;
  kind: Vector3DKind;
  /** Writes a whole vector; the pad snaps and clamps it per axis. */
  commit: ( next: Vector3DValue ) => void;
  ariaLabel: string;
  /**
   * Set while an interaction binding drives the triple: an iridescent point
   * and stem follow the value the sketch reads this frame, the base tip turns
   * hollow, and the path the binding sweeps (`area`, min corner → max
   * corner) is drawn dashed.
   */
  live?: {
    target: string;
    area: { x: { min: number;
      max: number };
    y: { min: number;
      max: number };
    z?: { min: number;
      max: number }; } | null;
  } | null;
};

function isTriple( value: BindingValue | undefined ): value is Vector3DValue {
  return !!value && typeof value === "object" && !Array.isArray( value ) &&
    Number.isFinite( value.x ) && Number.isFinite( value.y ) && Number.isFinite( value.z );
}

/** The 2D pad's frame, so the two controls read as one family. */
const FRAME_CLASS =
  "relative touch-none select-none overflow-hidden rounded-lg border border-theme bg-background/50 focus:outline-none focus:ring-1 focus:ring-theme";

/** Tiny corner caption naming an axis, as on the 2D pad. */
const AXIS_LABEL_CLASS =
  "pointer-events-none absolute bg-background/70 px-px font-mono text-[7px] leading-none text-gray-400";

/** Cube-space units → SVG units around the 50,50 centre. √3 · 27 < 48, so a full cube fits the frame. */
const SCALE = 27;
/** Radians of orbit per pixel dragged on the background. */
const ORBIT_RATE = Math.PI / 220;
const MAX_PITCH = Math.PI / 2 - 0.05;

/** Clamps a cube-space coordinate into the box. */
function clampCube( c: Vector3DValue ): Vector3DValue {
  return {
    x: clamp(
      c.x,
      -1,
      1
    ),
    y: clamp(
      c.y,
      -1,
      1
    ),
    z: clamp(
      c.z,
      -1,
      1
    )
  };
}

/**
 * Keyboard nudge: arrows move x / y (Up is "up on the canvas", which `yDown`
 * decides), PageUp / PageDown move z, Shift multiplies the step by ten.
 * Returns null for any other key so the caller can let it through.
 */
function nudgeFromKey(
  event: {
    key: string;
    shiftKey: boolean;
  },
  current: Vector3DValue,
  axes: Axes3D,
  yDown: boolean
): Vector3DValue | null {
  const moves: Record<string, Vector3DValue> = {
    ArrowLeft: {
      x: -1,
      y: 0,
      z: 0
    },
    ArrowRight: {
      x: 1,
      y: 0,
      z: 0
    },
    ArrowUp: {
      x: 0,
      y: yDown ? -1 : 1,
      z: 0
    },
    ArrowDown: {
      x: 0,
      y: yDown ? 1 : -1,
      z: 0
    },
    PageUp: {
      x: 0,
      y: 0,
      z: 1
    },
    PageDown: {
      x: 0,
      y: 0,
      z: -1
    }
  };

  const move = moves[ event.key ];

  if ( !move ) {
    return null;
  }

  const factor = event.shiftKey ? 10 : 1;

  return {
    x: snapToAxis(
      current.x + move.x * factor * ( axes.xAxis.step ?? 0.01 ),
      axes.xAxis
    ),
    y: snapToAxis(
      current.y + move.y * factor * ( axes.yAxis.step ?? 0.01 ),
      axes.yAxis
    ),
    z: snapToAxis(
      current.z + move.z * factor * ( axes.zAxis.step ?? 0.01 ),
      axes.zAxis
    )
  };
}

type Session =
  | {
    mode: "tip";
    startCube: Vector3DValue;
    startX: number;
    startY: number;
    width: number;
    height: number;
  }
  | {
    mode: "orbit";
    startView: ViewOrientation;
    startX: number;
    startY: number;
  };

const toSvg = ( p: Vector3DValue ) => ( {
  x: 50 + p.x * SCALE,
  y: 50 - p.y * SCALE
} );

const BOX_EDGES: [Vector3DValue, Vector3DValue][] = ( () => {
  const corners: Vector3DValue[] = [];

  for ( const x of [
    -1,
    1
  ] ) {
    for ( const y of [
      -1,
      1
    ] ) {
      for ( const z of [
        -1,
        1
      ] ) {
        corners.push( {
          x,
          y,
          z
        } );
      }
    }
  }

  const edges: [Vector3DValue, Vector3DValue][] = [];

  for ( let i = 0; i < corners.length; i++ ) {
    for ( let j = i + 1; j < corners.length; j++ ) {
      const a = corners[ i ];
      const b = corners[ j ];
      const differing = Number( a.x !== b.x ) + Number( a.y !== b.y ) + Number( a.z !== b.z );

      if ( differing === 1 ) {
        edges.push( [
          a,
          b
        ] );
      }
    }
  }

  return edges;
} )();

/**
 * An orbitable axonometric box — the axis ranges — with the vector drawn as
 * an arrow from the true origin, a dropped "shadow" onto the floor for depth,
 * and the axis letters at their positive ends. Drag the tip to move it in the
 * plane of the screen; hold Shift to push it in depth; hold x, y or z to slide
 * along one axis (Blender's G-then-axis); Ctrl snaps to the quarter grid and
 * Escape cancels. Drag the background to orbit the view, double-click it to
 * reset.
 *
 * This is the whole 3D control: it is the one presentation where the three
 * numbers are seen as a point in space rather than as three readings, which
 * is why it won over the flat pads and the trackball (`docs/vector3d-control.md`).
 */
export default function Vector3DBox( {
  current, axes, yDown, kind, commit, ariaLabel, live = null
}: Props ) {
  const frameRef = useRef<HTMLDivElement>( null );
  const liveDotRef = useRef<HTMLSpanElement>( null );
  const liveStemRef = useRef<SVGLineElement>( null );
  const sessionRef = useRef<Session | null>( null );
  const heldAxisRef = useRef<AxisName | null>( null );
  const [
    view,
    setView
  ] = useState<ViewOrientation>( DEFAULT_VIEW );

  const cube = toCube(
    current,
    axes,
    yDown
  );
  // Where the value 0,0,0 sits, kept inside the box: the arrow's tail and the
  // axes' crossing. For an unsigned range it is a corner.
  const origin = clampCube( toCube(
    {
      x: 0,
      y: 0,
      z: 0
    },
    axes,
    yDown
  ) );

  const project = ( p: Vector3DValue ) => toSvg( projectPoint(
    p,
    view
  ) );

  const tip = project( cube );
  const tail = project( origin );
  const foot = project( {
    ...cube,
    y: -1
  } );
  const originFoot = project( {
    ...origin,
    y: -1
  } );

  const beginTipDrag = ( event: React.PointerEvent ) => {
    const frame = frameRef.current;

    if ( !frame ) {
      return;
    }

    const rect = frame.getBoundingClientRect();

    sessionRef.current = {
      mode: "tip",
      startCube: cube,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height
    };
  };

  const handlePointerDown = ( event: React.PointerEvent<HTMLDivElement> ) => {
    event.currentTarget.setPointerCapture( event.pointerId );
    event.currentTarget.focus();

    // The tip's own handler ran first (it bubbles up to here) and opened a
    // tip session; anything else starts an orbit.
    if ( sessionRef.current?.mode !== "tip" ) {
      sessionRef.current = {
        mode: "orbit",
        startView: view,
        startX: event.clientX,
        startY: event.clientY
      };
    }
  };

  const handlePointerMove = ( event: React.PointerEvent<HTMLDivElement> ) => {
    const session = sessionRef.current;

    if ( !session || !event.currentTarget.hasPointerCapture( event.pointerId ) ) {
      return;
    }

    const dxPx = event.clientX - session.startX;
    const dyPx = event.clientY - session.startY;

    if ( session.mode === "orbit" ) {
      setView( {
        yaw: session.startView.yaw + dxPx * ORBIT_RATE,
        pitch: clamp(
          session.startView.pitch + dyPx * ORBIT_RATE,
          -MAX_PITCH,
          MAX_PITCH
        )
      } );

      return;
    }

    // Pixels → cube units in the screen plane (y up).
    const dsx = ( dxPx / session.width ) * ( 100 / SCALE );
    const dsy = -( dyPx / session.height ) * ( 100 / SCALE );
    const heldAxis = heldAxisRef.current;
    let delta: Vector3DValue;

    if ( heldAxis ) {
      delta = scale3(
        UNIT_AXES[ heldAxis ],
        axisDragAmount(
          dsx,
          dsy,
          UNIT_AXES[ heldAxis ],
          view
        )
      );
    } else if ( event.shiftKey ) {
      // Depth: dragging down brings the point toward the viewer, which is
      // where "closer" lands on screen once the camera is above the floor.
      delta = scale3(
        viewDepthAxis( view ),
        -dsy
      );
    } else {
      delta = unprojectScreenDelta(
        dsx,
        dsy,
        view
      );
    }

    let next = clampCube( add3(
      session.startCube,
      delta
    ) );

    // Ctrl snaps to the box's quarter grid, the gizmo's own tick marks.
    if ( event.ctrlKey ) {
      next = {
        x: Math.round( next.x * 4 ) / 4,
        y: Math.round( next.y * 4 ) / 4,
        z: Math.round( next.z * 4 ) / 4
      };
    }

    commit( fromCube(
      next,
      axes,
      yDown
    ) );
  };

  const endSession = () => {
    sessionRef.current = null;
  };

  const handleKeyDown = ( event: React.KeyboardEvent<HTMLDivElement> ) => {
    const session = sessionRef.current;

    if ( event.key === "Escape" && session ) {
      // Cancel: a tip drag goes back to where it started, an orbit back to
      // the orientation it started from. Swallowed so the page's own Escape
      // (presentation mode) does not fire on top.
      event.preventDefault();
      event.stopPropagation();

      if ( session.mode === "tip" ) {
        commit( fromCube(
          session.startCube,
          axes,
          yDown
        ) );
      } else {
        setView( session.startView );
      }

      sessionRef.current = null;

      return;
    }

    const key = event.key.toLowerCase();

    if ( key === "x" || key === "y" || key === "z" ) {
      heldAxisRef.current = key;
      event.preventDefault();

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

  const handleKeyUp = ( event: React.KeyboardEvent<HTMLDivElement> ) => {
    if ( event.key.toLowerCase() === heldAxisRef.current ) {
      heldAxisRef.current = null;
    }
  };

  // Axis letters sit just past the positive end of each axis line. With
  // yDown the positive y is the bottom of the box.
  const axisLines = ( [
    "x",
    "y",
    "z"
  ] as AxisName[] ).map( ( axis ) => {
    const unit = UNIT_AXES[ axis ];
    const sign = axis === "y" && yDown ? -1 : 1;
    const from = {
      ...origin,
      [ axis ]: -1
    };
    const to = {
      ...origin,
      [ axis ]: 1
    };
    const letterAt = add3(
      {
        ...origin,
        [ axis ]: sign
      },
      scale3(
        unit,
        sign * 0.22
      )
    );

    return {
      axis,
      from: project( from ),
      to: project( to ),
      letter: project( letterAt )
    };
  } );

  const shadowVisible = kind === "position";

  // Driven: the live point goes through the same orbit projection as the
  // tip, which CSS cannot do, so the bridge's subscriber writes the dot's
  // position and the stem's end directly — no React render per frame. Re-run
  // on an orbit or a base edit, so a paused sketch still redraws in place.
  const liveTarget = live?.target ?? null;

  useLayoutEffect( () => {
    const dot = liveDotRef.current;
    const stem = liveStemRef.current;

    if ( !liveTarget || !dot || !stem ) {
      return;
    }

    const write = ( values: Record<string, BindingValue> ) => {
      const value = values[ liveTarget ];
      const point = project( clampCube( toCube(
        isTriple( value ) ? value : current,
        axes,
        yDown
      ) ) );

      dot.style.left = `${ point.x }%`;
      dot.style.top = `${ point.y }%`;
      stem.setAttribute(
        "x2",
        String( point.x )
      );
      stem.setAttribute(
        "y2",
        String( point.y )
      );
    };

    write( getBindingValues() );

    return subscribeBindingValues( write );
  } );

  // The path the binding sweeps: from the corner of every axis' min to the
  // corner of every axis' max.
  const sweep = live?.area?.z
    ? {
      from: project( clampCube( toCube(
        {
          x: live.area.x.min,
          y: live.area.y.min,
          z: live.area.z.min
        },
        axes,
        yDown
      ) ) ),
      to: project( clampCube( toCube(
        {
          x: live.area.x.max,
          y: live.area.y.max,
          z: live.area.z.max
        },
        axes,
        yDown
      ) ) )
    }
    : null;
  const liveDecimals = Math.max( ...[
    axes.xAxis.step,
    axes.yAxis.step,
    axes.zAxis.step
  ].map( ( step ) => ( step !== undefined && step < 1 ? 2 : 0 ) ) );

  return (
    <div
      ref={ frameRef }
      role="application"
      tabIndex={ 0 }
      aria-label={ `${ ariaLabel } 3D view` }
      onPointerDown={ handlePointerDown }
      onPointerMove={ handlePointerMove }
      onPointerUp={ endSession }
      onPointerCancel={ endSession }
      onBlur={ () => {
        heldAxisRef.current = null;
      } }
      onDoubleClick={ () => setView( DEFAULT_VIEW ) }
      onKeyDown={ handleKeyDown }
      onKeyUp={ handleKeyUp }
      className={ clsx(
        FRAME_CLASS,
        "aspect-square w-full cursor-grab active:cursor-grabbing",
        live && "binding-live-ring"
      ) }
      title="Drag the tip to move it · Shift: depth · hold x / y / z: one axis · Ctrl: snap to the grid · Esc cancels · drag elsewhere to orbit · double-click resets the view"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        {/* The box the ranges span. */}
        {BOX_EDGES.map( (
          [
            a,
            b
          ], index
        ) => {
          const pa = project( a );
          const pb = project( b );

          return (
            <line
              key={ index }
              x1={ pa.x }
              y1={ pa.y }
              x2={ pb.x }
              y2={ pb.y }
              className="stroke-theme/40"
              strokeWidth={ 0.5 }
              vectorEffect="non-scaling-stroke"
            />
          );
        } )}

        {/* The axes through the origin. */}
        {axisLines.map( ( line ) => (
          <line
            key={ line.axis }
            x1={ line.from.x }
            y1={ line.from.y }
            x2={ line.to.x }
            y2={ line.to.y }
            className="stroke-theme/60"
            strokeWidth={ 0.5 }
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        ) )}

        {/* Depth cue: the point's shadow on the floor, and the stem up to it. */}
        {shadowVisible && (
          <>
            <line
              x1={ originFoot.x }
              y1={ originFoot.y }
              x2={ foot.x }
              y2={ foot.y }
              className="stroke-foreground/30"
              strokeWidth={ 0.75 }
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={ foot.x }
              y1={ foot.y }
              x2={ tip.x }
              y2={ tip.y }
              className="stroke-foreground/30"
              strokeWidth={ 0.75 }
              strokeDasharray="1.5 1.5"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={ foot.x }
              cy={ foot.y }
              r={ 1.4 }
              className="fill-foreground/30"
            />
          </>
        )}

        {sweep && (
          <line
            x1={ sweep.from.x }
            y1={ sweep.from.y }
            x2={ sweep.to.x }
            y2={ sweep.to.y }
            className="stroke-foreground/40"
            strokeWidth={ 1 }
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {live && (
          <line
            ref={ liveStemRef }
            x1={ tail.x }
            y1={ tail.y }
            x2={ tip.x }
            y2={ tip.y }
            className="stroke-foreground"
            strokeWidth={ 1.25 }
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* The vector itself. */}
        <line
          x1={ tail.x }
          y1={ tail.y }
          x2={ tip.x }
          y2={ tip.y }
          className="stroke-foreground/70"
          strokeWidth={ 1 }
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={ tail.x }
          cy={ tail.y }
          r={ 1.2 }
          className="fill-foreground/50"
        />

        {/* The grab handle: a generous hit disc under a small visible dot. */}
        <circle
          cx={ tip.x }
          cy={ tip.y }
          r={ 8 }
          className="cursor-move fill-transparent"
          onPointerDown={ beginTipDrag }
        />
        <circle
          cx={ tip.x }
          cy={ tip.y }
          r={ 3 }
          className={ clsx(
            "pointer-events-none",
            live ? "fill-background stroke-foreground" : "fill-foreground stroke-background"
          ) }
          strokeWidth={ 0.75 }
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {live && (
        <>
          <span
            ref={ liveDotRef }
            aria-hidden="true"
            className="binding-iridescent pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background shadow"
            style={ {
              left: `${ tip.x }%`,
              top: `${ tip.y }%`
            } }
          />
          <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded-sm bg-background/70 px-0.5 font-mono text-[9px] leading-tight tabular-nums text-foreground">
            {( [
              "x",
              "y",
              "z"
            ] as const ).map( (
              axis, index
            ) => (
              <span key={ axis }>
                {index > 0 && ", "}
                <LiveBindingValue
                  target={ live.target }
                  axis={ axis }
                  decimals={ liveDecimals }
                  fallback={ current[ axis ].toFixed( liveDecimals ) }
                />
              </span>
            ) )}
          </span>
        </>
      )}

      {axisLines.map( ( line ) => (
        <span
          key={ line.axis }
          className={ `${ AXIS_LABEL_CLASS } -translate-x-1/2 -translate-y-1/2` }
          style={ {
            left: `${ line.letter.x }%`,
            top: `${ line.letter.y }%`
          } }
        >
          {line.axis}
        </span>
      ) )}
    </div>
  );
}
