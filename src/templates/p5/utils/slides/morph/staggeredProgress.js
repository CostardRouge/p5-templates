function clamp01( value ) {
  if ( !Number.isFinite( value ) ) {
    return 0;
  }

  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Remap a global 0..1 morph progress to a per-group progress, so groups don't
 * all move in lockstep. `keyPos` is the group's normalised position (0..1):
 * group 0 leads, the last group trails by `spread`. Mirrors the
 * `staggeredProgress` used elsewhere in the sketches (spline-text/_shared.js).
 *
 * At global 0 every group is at 0; at global 1 every group is at 1, so segment
 * boundaries always settle cleanly.
 */
export default function staggeredProgress(
  global, keyPos, spread
) {
  if ( spread <= 0 ) {
    return clamp01( global );
  }

  const start = keyPos * spread;
  const span = 1 - spread;

  if ( span <= 0 ) {
    return global >= start ? 1 : 0;
  }

  return clamp01( ( global - start ) / span );
}
