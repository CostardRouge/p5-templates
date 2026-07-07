/**
 * Deterministic pseudo-random helpers.
 *
 * Templates must render identically for a given frame (the engine scrubs a
 * paused timeline for capture), so any "randomness" has to be seeded rather
 * than drawn from `Math.random()`.
 */

/** A small, fast LCG seeded PRNG returning floats in [0, 1). */
export function makeRandom( seed = 1 ) {
  let state = ( seed >>> 0 ) || 1;

  return function next() {
    state = ( state * 1664525 + 1013904223 ) >>> 0;

    return state / 4294967296;
  };
}

/**
 * Pre-compute `count` jitter values in [-amount, amount] from a seed — handy
 * for stable per-slot rotation/offset that doesn't change between frames.
 */
export function jitterArray(
  count, amount, seed = 1
) {
  const random = makeRandom( seed );

  return Array.from(
    {
      length: count
    },
    () => ( random() * 2 - 1 ) * amount
  );
}
