"use client";

import {
  useRef
} from "react";
import {
  useController, useFormContext
} from "react-hook-form";

import clamp from "@/utils/clamp";
import {
  fractionToValue,
  stepDecimals,
  valueToFraction,
  type AxisRange
} from "./utils/vector2dMath";

/**
 * Subset of the field config understood by the pad. Kept independent from
 * `FieldConfig` so the component stays reusable outside the form renderer.
 */
export interface Vector2DInputConfig {
  /**
   * When false, both axes are constrained to non-negative values ([0, max]) so
   * the vector can only point up/right — handy for scaling a vector's strength
   * down to 0 without flipping its direction. Defaults to true, which yields a
   * centered pad spanning [min, max] on both axes.
   */
  allowNegative?: boolean;
  /** Shared lower bound. Defaults to -1 (or 0 when `allowNegative` is false). */
  min?: number;
  /** Shared upper bound. Defaults to 1. */
  max?: number;
  /** Shared snapping increment. Defaults to 0.01. */
  step?: number;
  /** Per-axis overrides, merged over the shared min/max/step. */
  xAxis?: Partial<AxisRange>;
  yAxis?: Partial<AxisRange>;
}

type Vector2DValue = {
  x: number;
  y: number;
};

type Props = {
  name: string;
  config?: Vector2DInputConfig;
};

function resolveAxes( config: Vector2DInputConfig ): {
  xAxis: AxisRange;
  yAxis: AxisRange;
} {
  const allowNegative = config.allowNegative ?? true;
  const min = config.min ?? ( allowNegative ? -1 : 0 );
  const max = config.max ?? 1;
  const step = config.step ?? 0.01;

  return {
    xAxis: {
      min: config.xAxis?.min ?? min,
      max: config.xAxis?.max ?? max,
      step: config.xAxis?.step ?? step
    },
    yAxis: {
      min: config.yAxis?.min ?? min,
      max: config.yAxis?.max ?? max,
      step: config.yAxis?.step ?? step
    }
  };
}

export default function ControlledVector2DInput( {
  name, config = {}
}: Props ) {
  const {
    control
  } = useFormContext();

  const {
    field
  } = useController( {
    name,
    control
  } );

  const padRef = useRef<HTMLDivElement>( null );

  const {
    xAxis, yAxis
  } = resolveAxes( config );

  const raw = field.value as Partial<Vector2DValue> | undefined;
  const value: Vector2DValue = {
    x: typeof raw?.x === "number" ? raw.x : xAxis.min,
    y: typeof raw?.y === "number" ? raw.y : yAxis.min
  };

  // Preserve any sibling keys on the stored object while updating x/y.
  const commit = ( next: Vector2DValue ) => {
    field.onChange( {
      ...( raw && typeof raw === "object" ? raw : {} ),
      x: next.x,
      y: next.y
    } );
  };

  const updateFromPointer = (
    clientX: number, clientY: number
  ) => {
    const pad = padRef.current;

    if ( !pad ) {
      return;
    }

    const rect = pad.getBoundingClientRect();
    const fractionX = ( clientX - rect.left ) / rect.width;
    const fractionY = ( clientY - rect.top ) / rect.height;

    commit( {
      x: fractionToValue(
        fractionX,
        xAxis
      ),
      // Screen Y grows downward; flip it so the top of the pad is the max value.
      y: fractionToValue(
        1 - fractionY,
        yAxis
      )
    } );
  };

  const handlePointerDown = ( event: React.PointerEvent<HTMLDivElement> ) => {
    event.currentTarget.setPointerCapture( event.pointerId );
    updateFromPointer(
      event.clientX,
      event.clientY
    );
  };

  const handlePointerMove = ( event: React.PointerEvent<HTMLDivElement> ) => {
    if ( !event.currentTarget.hasPointerCapture( event.pointerId ) ) {
      return;
    }

    updateFromPointer(
      event.clientX,
      event.clientY
    );
  };

  const nudge = (
    dx: number, dy: number
  ) => {
    const round = (
      v: number, step: number | undefined
    ) => Number( v.toFixed( stepDecimals( step ) ) );

    commit( {
      x: clamp(
        round(
          value.x + dx * ( xAxis.step ?? 0.01 ),
          xAxis.step
        ),
        xAxis.min,
        xAxis.max
      ),
      y: clamp(
        round(
          value.y + dy * ( yAxis.step ?? 0.01 ),
          yAxis.step
        ),
        yAxis.min,
        yAxis.max
      )
    } );
  };

  const handleKeyDown = ( event: React.KeyboardEvent<HTMLDivElement> ) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [
        -1,
        0
      ],
      ArrowRight: [
        1,
        0
      ],
      ArrowUp: [
        0,
        1
      ],
      ArrowDown: [
        0,
        -1
      ]
    };

    const move = moves[ event.key ];

    if ( move ) {
      event.preventDefault();
      nudge(
        move[ 0 ],
        move[ 1 ]
      );
    }
  };

  const handleAxisInput = (
    axis: "x" | "y", rawValue: string
  ) => {
    const parsed = parseFloat( rawValue );

    if ( Number.isNaN( parsed ) ) {
      return;
    }

    const range = axis === "x" ? xAxis : yAxis;
    const clamped = clamp(
      parsed,
      range.min,
      range.max
    );

    commit( axis === "x"
      ? {
        ...value,
        x: clamped
      }
      : {
        ...value,
        y: clamped
      } );
  };

  // Positions expressed as percentages within the pad (top-left origin).
  const pointLeft = valueToFraction(
    value.x,
    xAxis
  ) * 100;
  const pointTop = ( 1 - valueToFraction(
    value.y,
    yAxis
  ) ) * 100;
  const originLeft = valueToFraction(
    0,
    xAxis
  ) * 100;
  const originTop = ( 1 - valueToFraction(
    0,
    yAxis
  ) ) * 100;

  const numberInputClassName =
    "w-full text-center text-xs font-mono px-1 py-0.5 rounded border border-theme/30 bg-theme/20 focus:outline-none focus:ring-1 focus:ring-theme";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="number"
          aria-label={ `${ name } x` }
          className={ numberInputClassName }
          value={ value.x }
          min={ xAxis.min }
          max={ xAxis.max }
          step={ xAxis.step }
          onChange={ ( event ) => handleAxisInput(
            "x",
            event.target.value
          ) }
        />
        <input
          type="number"
          aria-label={ `${ name } y` }
          className={ numberInputClassName }
          value={ value.y }
          min={ yAxis.min }
          max={ yAxis.max }
          step={ yAxis.step }
          onChange={ ( event ) => handleAxisInput(
            "y",
            event.target.value
          ) }
        />
      </div>

      <div
        ref={ padRef }
        role="application"
        tabIndex={ 0 }
        aria-label="2D vector pad"
        onPointerDown={ handlePointerDown }
        onPointerMove={ handlePointerMove }
        onKeyDown={ handleKeyDown }
        className="relative aspect-square w-full max-w-[160px] self-start cursor-crosshair touch-none select-none overflow-hidden rounded-lg border border-theme bg-background/50 focus:outline-none focus:ring-1 focus:ring-theme"
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Static grid through the geometric centre. */}
          <line
            x1="50"
            y1="0"
            x2="50"
            y2="100"
            className="stroke-theme/30"
            strokeWidth={ 0.5 }
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            className="stroke-theme/30"
            strokeWidth={ 0.5 }
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />

          {/* Vector from the origin (value 0,0) to the current value. */}
          <line
            x1={ originLeft }
            y1={ originTop }
            x2={ pointLeft }
            y2={ pointTop }
            className="stroke-foreground/60"
            strokeWidth={ 1 }
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <span
          className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-foreground shadow"
          style={ {
            left: `${ pointLeft }%`,
            top: `${ pointTop }%`
          } }
        />
      </div>
    </div>
  );
}
