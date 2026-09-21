"use client";

import {
  useRef
} from "react";

import {
  fractionToValue,
  valueToFraction,
  type AxisRange,
  type Vector3DValue
} from "../utils/vector3dMath";
import {
  AXIS_LABEL_CLASS,
  VIEW_FRAME_CLASS,
  nudgeFromKey,
  pointerFraction,
  type ViewProps
} from "./shared";

type PlaneSpec = {
  caption: string;
  horizontal: keyof Vector3DValue;
  vertical: keyof Vector3DValue;
  /** Whether the vertical axis' maximum sits at the BOTTOM of the pad. */
  verticalDown: boolean;
};

/**
 * Two orthographic pads — front (x·y) and top (x·z) — the CAD tri-view minus
 * its third panel, since x is shared. No depth ambiguity at all: each pad is
 * the 2D pad, and the two dots are two exact readings of one point. In the
 * top view +z runs DOWN the pad, as on a map seen with the camera at the
 * bottom edge, so "toward the viewer" is toward you here too.
 */
export default function PlanesView( {
  current, axes, yDown, commit, ariaLabel
}: ViewProps ) {
  const planes: PlaneSpec[] = [
    {
      caption: "front",
      horizontal: "x",
      vertical: "y",
      verticalDown: yDown
    },
    {
      caption: "top",
      horizontal: "x",
      vertical: "z",
      verticalDown: true
    }
  ];

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

  return (
    <div className="flex w-full items-stretch gap-1">
      {planes.map( ( plane ) => (
        <Plane
          key={ plane.caption }
          spec={ plane }
          current={ current }
          horizontalAxis={ axes[ `${ plane.horizontal }Axis` ] }
          verticalAxis={ axes[ `${ plane.vertical }Axis` ] }
          commit={ commit }
          onKeyDown={ handleKeyDown }
          ariaLabel={ ariaLabel }
        />
      ) )}
    </div>
  );
}

type PlaneProps = {
  spec: PlaneSpec;
  current: Vector3DValue;
  horizontalAxis: AxisRange;
  verticalAxis: AxisRange;
  commit: ( next: Vector3DValue ) => void;
  onKeyDown: ( event: React.KeyboardEvent<HTMLDivElement> ) => void;
  ariaLabel: string;
};

function Plane( {
  spec, current, horizontalAxis, verticalAxis, commit, onKeyDown, ariaLabel
}: PlaneProps ) {
  const padRef = useRef<HTMLDivElement>( null );

  const update = ( event: React.PointerEvent<HTMLDivElement> ) => {
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
      [ spec.horizontal ]: fractionToValue(
        fx,
        horizontalAxis
      ),
      [ spec.vertical ]: fractionToValue(
        spec.verticalDown ? fy : 1 - fy,
        verticalAxis
      )
    } );
  };

  const pointLeft = valueToFraction(
    current[ spec.horizontal ],
    horizontalAxis
  ) * 100;
  const verticalFraction = valueToFraction(
    current[ spec.vertical ],
    verticalAxis
  );
  const pointTop = ( spec.verticalDown ? verticalFraction : 1 - verticalFraction ) * 100;

  return (
    <div
      ref={ padRef }
      role="application"
      tabIndex={ 0 }
      aria-label={ `${ ariaLabel } ${ spec.caption } (${ spec.horizontal }·${ spec.vertical })` }
      onPointerDown={ ( event ) => {
        event.currentTarget.setPointerCapture( event.pointerId );
        event.currentTarget.focus();
        update( event );
      } }
      onPointerMove={ ( event ) =>
        event.currentTarget.hasPointerCapture( event.pointerId ) && update( event ) }
      onKeyDown={ onKeyDown }
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
      <span className={ `${ AXIS_LABEL_CLASS } left-0.5 top-0.5` }>{spec.caption}</span>
      <span className={ `${ AXIS_LABEL_CLASS } right-0.5 top-1/2 -translate-y-1/2` }>{spec.horizontal}</span>
      <span className={ `${ AXIS_LABEL_CLASS } left-1/2 -translate-x-1/2 ${ spec.verticalDown ? "bottom-0.5" : "top-0.5" }` }>
        {spec.vertical}
      </span>
      <span
        className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-foreground shadow"
        style={ {
          left: `${ pointLeft }%`,
          top: `${ pointTop }%`
        } }
      />
    </div>
  );
}
