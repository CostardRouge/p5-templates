/**
 * Shared animation-progression waveforms.
 *
 * Each waveform maps a normalized phase `p` in [0, 1) to a unipolar value in
 * [0, 1]. They are the reusable building block behind the "oscillation" form
 * option (see oscillatorFormConfiguration.js) so every sketch drives motion
 * from the same vocabulary: pick a shape, pick how many cycles per loop.
 *
 *   wave     ╱╱╱  sawtooth ramp  — travels 0→1, then snaps back
 *   sine     ◡◠   smooth breathing — eased in and out, rests at the ends
 *   triangle ◣◢   linear ping-pong — sharp peak, constant speed
 *   square   ▟▙   instant toggle  — on for `duty`, then off
 *
 * Pure module: no p5 / animation imports, so the math is unit-testable on its
 * own and safe to pull into the server-rendered form config.
 */

const TAU = Math.PI * 2;

export const WAVEFORMS = {
  wave: ( p ) => p,
  sine: ( p ) => 0.5 - 0.5 * Math.cos( TAU * p ),
  triangle: ( p ) => ( p < 0.5 ? p * 2 : 2 - p * 2 ),
  square: (
    p, duty = 0.5
  ) => ( p < duty ? 1 : 0 )
};

export const WAVEFORM_NAMES = Object.keys( WAVEFORMS );

/**
 * Positive modulo into [0, 1) — keeps the phase wrapped even while recording,
 * when the raw progression runs past 1 instead of looping back to 0.
 */
function wrap01( value ) {
  return ( ( value % 1 ) + 1 ) % 1;
}

/**
 * Resolve the wrapped phase for a linear progression:
 *   phase = wrap( progression * cycles + offset )
 */
export function oscillationPhase(
  progression, {
    cycles = 1, offset = 0
  } = {}
) {
  return wrap01( progression * cycles + offset );
}

/**
 * Evaluate an oscillation config against a linear progression (0→1).
 *
 * Returns a unipolar value in [0, 1]. `amplitude` scales the swing around the
 * 0.5 midpoint (1 = natural, < 1 shallower, > 1 punchier and clamped), so the
 * rest point stays centered no matter the depth.
 */
export function evaluateOscillation(
  progression, config = {}
) {
  const {
    waveform = "sine",
    cycles = 1,
    offset = 0,
    amplitude = 1,
    duty = 0.5
  } = config;

  const shape = WAVEFORMS[ waveform ] ?? WAVEFORMS.sine;
  const phase = oscillationPhase(
    progression,
    {
      cycles,
      offset
    }
  );
  const raw = shape(
    phase,
    duty
  );
  const scaled = 0.5 + ( raw - 0.5 ) * amplitude;

  return Math.min(
    1,
    Math.max(
      0,
      scaled
    )
  );
}
