/**
 * Constrains `value` to the inclusive range [`min`, `max`].
 *
 * @example
 * clamp(5, 0, 10)  // → 5
 * clamp(-3, 0, 10) // → 0
 * clamp(42, 0, 10) // → 10
 */
function clamp(
  value: number, min: number, max: number
): number {
  if ( value < min ) return min;
  if ( value > max ) return max;
  return value;
}

export default clamp;