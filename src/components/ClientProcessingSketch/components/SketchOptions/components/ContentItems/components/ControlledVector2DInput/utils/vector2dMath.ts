import clamp from "@/utils/clamp";

/**
 * Describes one axis of the 2D pad: the value range it spans and an optional
 * snapping increment. Both the x and y axes are configured independently so the
 * pad can map to symmetric direction vectors ([-1, 1]) or unsigned positions
 * ([0, 1]) alike.
 */
export interface AxisRange {
  min: number;
  max: number;
  /** When set, committed values snap to multiples of `step` measured from `min`. */
  step?: number;
}

/**
 * Subset of the field config understood by the pad. Kept independent from
 * `FieldConfig` so the component stays reusable outside the form renderer
 * (e.g. the video asset params editor, which drives it from plain state), and
 * kept here rather than in the component so non-React callers — the settings
 * randomizer — can resolve the same ranges without importing the pad.
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

/**
 * Number of decimal places implied by `step`, used to keep snapped values free
 * of floating-point noise (e.g. 0.01 → 2, 1 → 0, 0.5 → 1).
 */
export function stepDecimals( step: number | undefined ): number {
  if ( !step || !Number.isFinite( step ) ) {
    return 2;
  }

  const text = String( step );
  const dotIndex = text.indexOf( "." );

  return dotIndex === -1 ? 0 : text.length - dotIndex - 1;
}

/**
 * Fraction in [0, 1] describing where `value` sits within the axis range, where
 * 0 maps to `min` and 1 maps to `max`. The result is clamped so out-of-range
 * values still render inside the pad. Y inversion (top = max) is handled by the
 * caller, not here.
 */
export function valueToFraction(
  value: number, {
    min, max
  }: AxisRange
): number {
  if ( max === min ) {
    return 0;
  }

  return clamp(
    ( value - min ) / ( max - min ),
    0,
    1
  );
}

/**
 * Inverse of {@link valueToFraction}: turns a 0..1 fraction back into an axis
 * value, snapping to `step` (when provided) and clamping to [min, max].
 */
export function fractionToValue(
  fraction: number, {
    min, max, step
  }: AxisRange
): number {
  const ratio = clamp(
    fraction,
    0,
    1
  );

  let value = min + ratio * ( max - min );

  if ( step && step > 0 ) {
    const snapped = min + Math.round( ( value - min ) / step ) * step;

    value = Number( snapped.toFixed( stepDecimals( step ) ) );
  }

  return clamp(
    value,
    min,
    max
  );
}

/**
 * Turns a pad config into the two concrete axis ranges it describes, applying
 * the shared defaults first and the per-axis overrides on top.
 */
export function resolveAxes( config: Vector2DInputConfig ): {
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
 * A uniformly random point inside the pad, snapped to each axis' step — what
 * the randomize action assigns to a vector2d field. The two axes are drawn
 * independently so the result covers the whole square rather than its
 * diagonal. `yDown` plays no part here: the draw happens in value space, and
 * that flag only mirrors the pad's rendering.
 */
export function randomVector2D(
  config: Vector2DInputConfig, random: () => number = Math.random
): Vector2DValue {
  const {
    xAxis, yAxis
  } = resolveAxes( config );

  return {
    x: fractionToValue(
      random(),
      xAxis
    ),
    y: fractionToValue(
      random(),
      yAxis
    )
  };
}
