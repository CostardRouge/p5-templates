/**
 * Guards the shared oscillation waveforms used by the "oscillation" form
 * option. The runtime helper (oscillator.js) only wires these pure functions
 * to animation.progression, so covering the math here covers the behaviour
 * every sketch relies on: phases wrap, shapes stay in range, and the four
 * named waveforms keep their defining anchor points.
 */

import {
  WAVEFORM_NAMES,
  oscillationPhase,
  evaluateOscillation
} from "../oscillator/waveforms.js";

describe(
  "oscillation waveforms",
  () => {
    it(
      "exposes exactly the four documented waveforms",
      () => {
        expect( [
          ...WAVEFORM_NAMES
        ].sort() ).toEqual( [
          "sine",
          "square",
          "triangle",
          "wave"
        ] );
      }
    );

    it(
      "wraps the phase into [0, 1) for cycles and offset",
      () => {
        // 3 cycles over a full loop returns to 0 at the loop end.
        expect( oscillationPhase(
          1,
          {
            cycles: 3
          }
        ) ).toBeCloseTo( 0 );

        // Offset shifts the phase and wraps past 1.
        expect( oscillationPhase(
          0.5,
          {
            cycles: 1,
            offset: 0.75
          }
        ) ).toBeCloseTo( 0.25 );
      }
    );

    it(
      "keeps the phase wrapped when progression runs past 1 (recording)",
      () => {
        expect( oscillationPhase(
          2.25,
          {
            cycles: 1
          }
        ) ).toBeCloseTo( 0.25 );
      }
    );

    it(
      "anchors each waveform at its defining points",
      () => {
        // wave: linear ramp.
        expect( evaluateOscillation(
          0,
          {
            waveform: "wave"
          }
        ) ).toBeCloseTo( 0 );
        expect( evaluateOscillation(
          0.5,
          {
            waveform: "wave"
          }
        ) ).toBeCloseTo( 0.5 );

        // sine + triangle: start at 0, peak at the half-cycle.
        for ( const waveform of [
          "sine",
          "triangle"
        ] ) {
          expect( evaluateOscillation(
            0,
            {
              waveform
            }
          ) ).toBeCloseTo( 0 );
          expect( evaluateOscillation(
            0.5,
            {
              waveform
            }
          ) ).toBeCloseTo( 1 );
        }

        // square: on for the first half, off for the second.
        expect( evaluateOscillation(
          0.25,
          {
            waveform: "square"
          }
        ) ).toBe( 1 );
        expect( evaluateOscillation(
          0.75,
          {
            waveform: "square"
          }
        ) ).toBe( 0 );
      }
    );

    it(
      "stays within [0, 1] and centers on 0.5 as amplitude scales",
      () => {
        // amplitude 0 collapses every shape to the midpoint.
        expect( evaluateOscillation(
          0.5,
          {
            waveform: "triangle",
            amplitude: 0
          }
        ) ).toBeCloseTo( 0.5 );

        // amplitude > 1 punches past the natural swing but stays clamped.
        for ( let i = 0; i <= 10; i++ ) {
          const value = evaluateOscillation(
            i / 10,
            {
              waveform: "sine",
              amplitude: 2
            }
          );

          expect( value ).toBeGreaterThanOrEqual( 0 );
          expect( value ).toBeLessThanOrEqual( 1 );
        }
      }
    );

    it(
      "falls back to sine for an unknown waveform name",
      () => {
        expect( evaluateOscillation(
          0.5,
          {
            waveform: "not-a-waveform"
          }
        ) ).toBeCloseTo( evaluateOscillation(
          0.5,
          {
            waveform: "sine"
          }
        ) );
      }
    );
  }
);
