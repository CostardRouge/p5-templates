"use client";

import {
  Axis3d, Columns2, Orbit, PanelRight
} from "lucide-react";
import clsx from "clsx";
import {
  useRef, useState
} from "react";

import clamp from "@/utils/clamp";
import {
  VECTOR3D_VIEWS,
  axisRange,
  completeVector,
  defaultViewFor,
  resolveAxes3D,
  snapVector,
  type AxisName,
  type AxisRange,
  type Vector3DInputConfig,
  type Vector3DValue,
  type Vector3DView
} from "./utils/vector3dMath";
import GizmoView from "./views/GizmoView";
import OrbitView from "./views/OrbitView";
import PadDepthView from "./views/PadDepthView";
import PlanesView from "./views/PlanesView";

export type {
  Vector3DInputConfig, Vector3DValue, Vector3DView
} from "./utils/vector3dMath";

type Props = {
  /** Current value. Missing components fall back to each axis minimum. */
  value: Partial<Vector3DValue> | undefined;
  /** Always emits a complete `{ x, y, z }`; callers merge it back as they see fit. */
  onChange: ( value: Vector3DValue ) => void;
  config?: Vector3DInputConfig;
  /** Accessible name prefix for the x / y / z inputs and the views. Defaults to "vector". */
  ariaLabel?: string;
  /** Overrides the wrapper sizing. Defaults to a compact 176px-wide column. */
  className?: string;
};

const VIEW_META: Record<Vector3DView, {
  label: string;
  title: string;
  Icon: typeof Axis3d;
}> = {
  gizmo: {
    label: "3D",
    title: "3D view — drag the tip, Shift for depth, hold x/y/z for one axis, drag around to orbit",
    Icon: Axis3d
  },
  planes: {
    label: "front · top",
    title: "Two orthographic pads: front (x·y) and top (x·z)",
    Icon: Columns2
  },
  "pad-depth": {
    label: "pad + z",
    title: "The x·y pad with a z fader beside it",
    Icon: PanelRight
  },
  orbit: {
    label: "sphere",
    title: "Trackball: drag to turn the direction, the strip sets its length",
    Icon: Orbit
  }
};

/**
 * Presentational 3D vector control: three number fields (drag their letter to
 * scrub) over one of four interchangeable views, each a different answer to
 * "how do you point at a place in space with a flat pointer". The value model
 * is always cartesian `{ x, y, z }`; the views only change the gesture.
 * Fully controlled and form-agnostic — {@link ControlledVector3DInput} wires
 * it to react-hook-form.
 */
export default function Vector3DPad( {
  value, onChange, config = {}, ariaLabel = "vector", className
}: Props ) {
  const axes = resolveAxes3D( config );
  const yDown = config.yDown ?? false;
  const kind = config.kind ?? "position";
  const [
    view,
    setView
  ] = useState<Vector3DView>( () => defaultViewFor( config ) );

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

  const viewProps = {
    current,
    axes,
    yDown,
    kind,
    commit,
    ariaLabel
  };

  const View = view === "gizmo"
    ? GizmoView
    : view === "planes"
      ? PlanesView
      : view === "pad-depth"
        ? PadDepthView
        : OrbitView;

  return (
    // 176px: three signed two-decimal fields need ~52px each (see the 2D pad's
    // 140px note), and the views follow the same width.
    <div className={ className ?? "flex w-full max-w-[176px] flex-col gap-1" }>
      <div className="flex items-center gap-1">
        {( [
          "x",
          "y",
          "z"
        ] as AxisName[] ).map( ( axis ) => (
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

      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-mono text-[9px] uppercase tracking-wide text-label/70">
          {VIEW_META[ view ].label}
        </span>
        <div
          role="tablist"
          aria-label={ `${ ariaLabel } view` }
          className="flex shrink-0 items-center gap-0.5"
        >
          {VECTOR3D_VIEWS.map( ( candidate ) => {
            const {
              Icon, title
            } = VIEW_META[ candidate ];
            const active = candidate === view;

            return (
              <button
                key={ candidate }
                type="button"
                role="tab"
                aria-selected={ active }
                tabIndex={ -1 }
                title={ title }
                onClick={ () => setView( candidate ) }
                className={ clsx(
                  "grid h-5 w-5 place-items-center rounded border transition-colors",
                  active
                    ? "border-theme bg-foreground/10 text-foreground"
                    : "border-transparent text-label/60 hover:bg-hover hover:text-foreground"
                ) }
              >
                <Icon className="h-3 w-3" />
              </button>
            );
          } )}
        </div>
      </div>

      <View { ...viewProps } />
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
