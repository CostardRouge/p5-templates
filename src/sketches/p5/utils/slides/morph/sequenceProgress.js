function clamp01( value ) {
  if ( !Number.isFinite( value ) ) {
    return 0;
  }

  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Per-item morph progress with a SIZED, sliding time window — used by the
 * montage transition to change the individual parameters that differ one after
 * another rather than all at once.
 *
 * Unlike the shared `staggeredProgress` (overlapping windows of a fixed 1-spread
 * width), here `spread` (0..1) sizes each window so full-spread slices are even
 * and non-overlapping:
 *   - 0 → every item shares the full window: all change together.
 *   - 1 → items get equal, NON-overlapping slices: item 0 over [0, 1/count],
 *         item 1 over [1/count, 2/count], … i.e. strictly one at a time.
 *   - between → the windows shrink and slide apart, partially overlapping.
 *
 * `t` is the (already eased) global morph progress 0..1. Every item is at 0 at
 * t=0 and at 1 at t=1, so segment boundaries always settle cleanly.
 */
export default function sequenceProgress(
  t, index, count, spread
) {
  const progress = clamp01( t );

  if ( count <= 1 || spread <= 0 ) {
    return progress;
  }

  const s = clamp01( spread );
  // Window width shrinks from the full range (s=0) to one even slice (s=1).
  const width = 1 - s * ( 1 - 1 / count );
  const startSpan = 1 - width;
  const start = ( index / ( count - 1 ) ) * startSpan;

  if ( width <= 0 ) {
    return progress >= start ? 1 : 0;
  }

  return clamp01( ( progress - start ) / width );
}
