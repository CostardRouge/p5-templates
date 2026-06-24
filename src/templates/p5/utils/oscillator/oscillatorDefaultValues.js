/**
 * Default values for the shared "oscillation" option.
 *
 * Pair with oscillatorFormConfiguration.js in a sketch's options.ts, then read
 * it at runtime with oscillator.value() / signed() / phase().
 */

const oscillationValues = {
  waveform: "sine",
  cycles: 1,
  offset: 0,
  amplitude: 1
};

export default oscillationValues;
