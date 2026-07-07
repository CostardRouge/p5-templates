import animation from "../animation.js";
import {
  WAVEFORMS,
  WAVEFORM_NAMES,
  oscillationPhase,
  evaluateOscillation
} from "./waveforms.js";

/**
 * Runtime helper for the shared "oscillation" option.
 *
 * Reads the global loop progression (animation.progression, 0→1 across the
 * loop) by default, so a sketch only needs:
 *
 *   import oscillator from "@/p5/utils/oscillator/oscillator.js";
 *   const t = oscillator.value( options.sketch.oscillation ); // 0..1
 *
 * Pass an explicit `progression` to drive several oscillators off one clock,
 * or to reuse the math outside the draw loop.
 */
const oscillator = {
  waveforms: WAVEFORMS,
  names: WAVEFORM_NAMES,

  // Unipolar 0..1 — the everyday driver for scale / alpha / index / position.
  value(
    config = {}, progression = animation.progression
  ) {
    return evaluateOscillation(
      progression,
      config
    );
  },

  // Bipolar -1..1 — centered on 0, for symmetric offsets (translate, rotate).
  signed(
    config = {}, progression = animation.progression
  ) {
    return evaluateOscillation(
      progression,
      config
    ) * 2 - 1;
  },

  // Raw wrapped phase 0..1 (before the waveform) — for custom shaping.
  phase(
    config = {}, progression = animation.progression
  ) {
    return oscillationPhase(
      progression,
      config
    );
  }
};

export default oscillator;
export {
  WAVEFORMS, WAVEFORM_NAMES, oscillationPhase, evaluateOscillation
};
