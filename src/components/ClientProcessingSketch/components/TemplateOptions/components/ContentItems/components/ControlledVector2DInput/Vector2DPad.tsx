"use client";

import clamp from "@/utils/clamp";
import usePreventTouchScroll from "@/hooks/usePreventTouchScroll";
import {
  fractionToValue,
  stepDecimals,
  valueToFraction,
  type AxisRange
} from "./utils/vector2dMath";

/**
 * Subset of the field config understood by the pad. Kept independent from
 * `FieldConfig` so the component stays reusable outside the form renderer
 * (e.g. the video asset params editor, which drives it from plain state).
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
  /**
   * Invert the vertical axis so the top of the pad maps to the *minimum* value.
   * Use it for screen-space positions (where y grows downward): dragging the
   * handle up then moves the point toward the top of the canvas. Defaults to
   * false (top = max), matching the "Y points up" convention used for vectors.
   */
  yDown?: boolean;
}

export type Vector2DValue = {
  x: number;
  y: number;
};

type Props = {
  /**
   * Current value. Partial / undefined values fall back to each axis minimum so
   * the pad still renders for half-initialized form state.
   */
  value: Partial<Vector2DValue> | undefined;
  /** Always emits a complete `{ x, y }`; callers merge it back as they see fit. */
  onChange: ( value: Vector2DValue ) => void;
  config?: Vector2DInputConfig;
  /** Accessible name prefix for the x / y number inputs. Defaults to "vector". */
  ariaLabel?: string;
  /** Overrides the wrapper sizing. Defaults to a compact 100px-wide column. */
  className?: string;
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

/**
 * Presentational 2D vector pad: two number inputs plus a draggable square that
 * edits an `{ x, y }` pair at once. It is fully controlled and form-agnostic —
 * {@link ControlledVector2DInput} wires it to react-hook-form, while other
 * callers (e.g. the video params editor) drive it from local state.
 */
export default function Vector2DPad( {
  value, onChange, config = {}, ariaLabel = "vector", className
}: Props ) {
  const padRef = usePreventTouchScroll<HTMLDivElement>();

  const {
    xAxis, yAxis
  } = resolveAxes( config );

  const yDown = config.yDown ?? false;

  // Convert between a Y value and its vertical position in the pad (a 0..1
  // fraction where 0 is the top). Unless yDown is set, the axis is flipped so
  // the top of the pad represents the maximum value.
  const valueYToFraction = ( y: number ) => {
    const fraction = valueToFraction(
      y,
      yAxis
    );

    return yDown ? fraction : 1 - fraction;
  };

  const fractionToValueY = ( fraction: number ) => fractionToValue(
    yDown ? fraction : 1 - fraction,
    yAxis
  );

  const current: Vector2DValue = {
    x: typeof value?.x === "number" ? value.x : xAxis.min,
    y: typeof value?.y === "number" ? value.y : yAxis.min
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

    onChange( {
      x: fractionToValue(
        fractionX,
        xAxis
      ),
      y: fractionToValueY( fractionY )
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

    // `dy` is expressed in screen terms (+1 = up). Flip it for a non-inverted
    // axis so pressing "up" increases the value.
    const valueDy = yDown ? -dy : dy;

    onChange( {
      x: clamp(
        round(
          current.x + dx * ( xAxis.step ?? 0.01 ),
          xAxis.step
        ),
        xAxis.min,
        xAxis.max
      ),
      y: clamp(
        round(
          current.y + valueDy * ( yAxis.step ?? 0.01 ),
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

    onChange( axis === "x"
      ? {
        ...current,
        x: clamped
      }
      : {
        ...current,
        y: clamped
      } );
  };

  // Handle position as a percentage within the pad (top-left origin). The
  // guide line always emanates from the geometric centre so the pad reads
  // like a small graph, whatever the axis ranges.
  const pointLeft = valueToFraction(
    current.x,
    xAxis
  ) * 100;
  const pointTop = valueYToFraction( current.y ) * 100;

  const numberInputClassName =
    "w-full text-center text-xs font-mono px-1 py-0.5 rounded border border-theme/30 bg-theme/20 focus:outline-none focus:ring-1 focus:ring-theme";

  return (
    <div className={ className ?? "flex w-full max-w-[100px] flex-col gap-1" }>
      <div className="flex items-center gap-1">
        <input
          type="number"
          aria-label={ `${ ariaLabel } x` }
          className={ numberInputClassName }
          value={ current.x }
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
          aria-label={ `${ ariaLabel } y` }
          className={ numberInputClassName }
          value={ current.y }
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
        className="relative aspect-square w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg border border-theme bg-background/50 focus:outline-none focus:ring-1 focus:ring-theme"
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

          {/* Guide line from the centre of the pad to the current value. */}
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

        {/* Tiny axis labels so the active axis stays obvious. */}
        <span className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 bg-background/70 px-px font-mono text-[7px] leading-none text-gray-400">
          x
        </span>
        <span className="pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 bg-background/70 px-px font-mono text-[7px] leading-none text-gray-400">
          y
        </span>

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
