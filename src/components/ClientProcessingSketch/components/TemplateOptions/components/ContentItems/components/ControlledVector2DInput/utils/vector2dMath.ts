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
