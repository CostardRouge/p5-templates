"use client";

import {
  useRef
} from "react";

import clamp from "@/utils/clamp";
import {
  AXIS_NAMES,
  axisRange,
  completeVector,
  resolveAxes3D,
  snapVector,
  type AxisName,
  type AxisRange,
  type Vector3DInputConfig,
  type Vector3DValue
} from "./utils/vector3dMath";
import Vector3DBox from "./Vector3DBox";

export type {
  Vector3DInputConfig, Vector3DValue
} from "./utils/vector3dMath";

type Props = {
  /** Current value. Missing components fall back to each axis minimum. */
  value: Partial<Vector3DValue> | undefined;
  /** Always emits a complete `{ x, y, z }`; callers merge it back as they see fit. */
  onChange: ( value: Vector3DValue ) => void;
  config?: Vector3DInputConfig;
  /** Accessible name prefix for the x / y / z inputs and the box. Defaults to "vector". */
  ariaLabel?: string;
  /** Overrides the wrapper sizing. Defaults to a compact 176px-wide column. */
  className?: string;
};

/**
 * Presentational 3D vector control: three number fields (drag their letter to
 * scrub) over {@link Vector3DBox}, an orbitable axonometric box where the
 * value reads as a point in space. Fully controlled and form-agnostic —
 * {@link ControlledVector3DInput} wires it to react-hook-form.
 *
 * Three other presentations were built and compared against this one (two
 * orthographic pads, the 2D pad plus a z fader, a trackball sphere) and then
 * dropped: the box does what they do and shows depth while doing it, and one
 * control means one gesture to learn instead of a picker. They are written up
 * as proposals in `docs/vector3d-control.md`; do not reintroduce a view
 * switcher without that conversation happening again.
 */
export default function Vector3DPad( {
  value, onChange, config = {}, ariaLabel = "vector", className
}: Props ) {
  const axes = resolveAxes3D( config );
  const yDown = config.yDown ?? false;
  const kind = config.kind ?? "position";

  const current = completeVector(
    value,
    axes
  );
  // The whole vector as a scrub started, so Alt-scrubbing one letter can
  // slide all three components by the same amount from where they were.
  const scrubStartRef = useRef<Vector3DValue>( current );

  const commit = ( next: Vector3DValue ) => onChange( snapVector(
    next,
    axes
  ) );

  const handleScrub = (
    axis: AxisName, delta: number, all: boolean
  ) => {
    const start = scrubStartRef.current;

    if ( all ) {
      commit( {
        x: start.x + delta,
        y: start.y + delta,
        z: start.z + delta
      } );

      return;
    }

    commit( {
      ...current,
      [ axis ]: start[ axis ] + delta
    } );
  };

  return (
    // 176px: three signed two-decimal fields need ~52px each (see the 2D pad's
    // 140px note), and the box follows the same width.
    <div className={ className ?? "flex w-full max-w-[176px] flex-col gap-1" }>
      <div className="flex items-center gap-1">
        {AXIS_NAMES.map( ( axis ) => (
          <AxisNumberField
            key={ axis }
            axis={ axis }
            value={ current[ axis ] }
            range={ axisRange(
              axes,
              axis
            ) }
            ariaLabel={ `${ ariaLabel } ${ axis }` }
            onChange={ ( next ) => onChange( {
              ...current,
              [ axis ]: next
            } ) }
            onScrubStart={ () => {
              scrubStartRef.current = current;
            } }
            onScrub={ (
              delta, all
            ) => handleScrub(
              axis,
              delta,
              all
            ) }
          />
        ) )}
      </div>

      <Vector3DBox
        current={ current }
        axes={ axes }
        yDown={ yDown }
        kind={ kind }
        commit={ commit }
        ariaLabel={ ariaLabel }
      />
    </div>
  );
}

type AxisNumberFieldProps = {
  axis: AxisName;
  value: number;
  range: AxisRange;
  ariaLabel: string;
  onChange: ( next: number ) => void;
  onScrubStart: () => void;
  /** `delta` is in value units from the scrub's start; `all` when Alt is held. */
  onScrub: ( delta: number, all: boolean ) => void;
};

/**
 * One coordinate: a spinner-less number input (same reasoning as the 2D pad's)
 * with its axis letter on the left. The letter is a scrub handle — drag it
 * sideways to slide the value by one step per pixel, ten with Shift — the
 * Blender / Unity / Leva gesture for a numeric field; with Alt held all three
 * components slide together (Houdini's and PCUI's label-drag).
 */
function AxisNumberField( {
  axis, value, range, ariaLabel, onChange, onScrubStart, onScrub
}: AxisNumberFieldProps ) {
  const scrubRef = useRef<{
    startX: number;
  } | null>( null );

  const handleInput = ( raw: string ) => {
    const parsed = parseFloat( raw );

    if ( Number.isNaN( parsed ) ) {
      return;
    }

    onChange( clamp(
      parsed,
      range.min,
      range.max
    ) );
  };

  return (
    <div className="relative min-w-0 flex-1">
      <span
        role="presentation"
        className="absolute left-0 top-0 flex h-full w-3.5 cursor-ew-resize touch-none select-none items-center justify-center font-mono text-[8px] leading-none text-label/70"
        title={ `Drag to scrub ${ axis } · Shift: ×10 · Alt: all three` }
        onPointerDown={ ( event ) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture( event.pointerId );
          scrubRef.current = {
            startX: event.clientX
          };
          onScrubStart();
        } }
        onPointerMove={ ( event ) => {
          const scrub = scrubRef.current;

          if ( !scrub || !event.currentTarget.hasPointerCapture( event.pointerId ) ) {
            return;
          }

          const step = range.step ?? 0.01;
          const factor = event.shiftKey ? 10 : 1;

          onScrub(
            ( event.clientX - scrub.startX ) * step * factor,
            event.altKey
          );
        } }
        onPointerUp={ () => {
          scrubRef.current = null;
        } }
        onPointerCancel={ () => {
          scrubRef.current = null;
        } }
      >
        {axis}
      </span>
      <input
        type="number"
        aria-label={ ariaLabel }
        className="w-full min-w-0 rounded border border-theme/30 bg-theme/20 py-0.5 pl-3.5 pr-1 text-center font-mono text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-theme [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
        value={ value }
        min={ range.min }
        max={ range.max }
        step={ range.step }
        onChange={ ( event ) => handleInput( event.target.value ) }
      />
    </div>
  );
}
