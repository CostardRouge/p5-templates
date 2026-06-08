/**
 * Motion helpers shared by GSAP/HTML photo templates.
 */

/**
 * Add a seamless, infinitely-scrolling tween to a track element.
 *
 * The track is expected to hold TWO copies of its content laid back-to-back,
 * so shifting it by exactly one `distance` (one copy) looks identical to its
 * start. The tween scrolls one copy per iteration and repeats `cycles` times,
 * filling the whole loop `duration` — so playback wraps without a visible jump.
 *
 *   axis     "x" (horizontal) or "y" (vertical)
 *   distance width/height of ONE content copy, in px
 *   cycles   how many copies scroll past per loop (integer ⇒ controls speed)
 *   reverse  scroll towards the positive direction (right / down)
 */
export function seamlessScroll(
  tl,
  target,
  {
    axis = "x",
    distance,
    cycles = 1,
    reverse = false,
    duration
  }
) {
  const safeCycles = Math.max(
    1,
    Math.round( cycles )
  );
  const from = reverse ? -distance : 0;
  const to = reverse ? 0 : -distance;

  tl.fromTo(
    target,
    {
      [ axis ]: from
    },
    {
      [ axis ]: to,
      duration: duration / safeCycles,
      ease: "none",
      repeat: safeCycles - 1,
      immediateRender: true
    },
    0
  );
}

/**
 * Build a custom GSAP ease that traces a full sine wave (phase-shifted) across
 * the tween's progress. Because the value at progress 0 equals the value at
 * progress 1 for any whole number of `cycles`, a single `fromTo` driven by this
 * ease oscillates seamlessly — and stays deterministic under frame scrubbing.
 *
 * Maps progress → [0, 1]: 0.5 + 0.5·sin(2π·(cycles·p + phase)).
 */
export function sineEase(
  cycles = 1, phase = 0
) {
  return function ease( progress ) {
    return 0.5 + 0.5 * Math.sin( 2 * Math.PI * ( cycles * progress + phase ) );
  };
}
