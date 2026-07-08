/**
 * @jest-environment jsdom
 *
 * Regression tests for the duration-scaled loop clock.
 *
 * The bug: changing the animation duration in Template Options did nothing to
 * the live sketch. Sketches drive their motion off the first `draw(time, …)`
 * argument, which used to be raw, unbounded `time.seconds()` — a value with no
 * `duration` term — so the duration only ever affected the progression bar
 * label and the recorded frame count, never the on-canvas cadence.
 *
 * The fix makes that argument the loop phase scaled by the baseline duration
 * (`time.drawSeconds()`), so the whole animation completes within `duration`:
 * a 1s loop runs the same motion the 12s default shows, only 12x faster, and
 * the live preview matches the recorded clip frame-for-frame.
 */

export {};

/* eslint-disable @typescript-eslint/no-require-imports */
const time = require( "@/p5/utils/time.js" ).default;
const animation = require( "@/p5/utils/animation.js" ).default;
const sketch = require( "@/p5/utils/sketch.js" ).default;
const {
  DURATION_DEFAULT
} = require( "@/lib/animationConfig" );
/* eslint-enable @typescript-eslint/no-require-imports */

function setDuration( duration: number ): void {
  sketch.sketchOptions = {
    size: {
      width: 1080,
      height: 1350
    },
    animation: {
      framerate: 60,
      duration
    }
  };
}

describe(
  "duration-scaled loop clock",
  () => {
    beforeEach( () => {
      window.disableRecordingMode!();
      time.reset();
    } );

    test(
      "at the default duration the draw clock equals real seconds within a loop",
      () => {
        setDuration( DURATION_DEFAULT );
        time.elapsed = 5000; // 5s into a 12s loop

        expect( time.drawSeconds() ).toBeCloseTo(
          5,
          6
        );
        expect( animation.progression ).toBeCloseTo(
          5 / DURATION_DEFAULT,
          6
        );
      }
    );

    test(
      "a 1s loop is 12x faster: half the loop is reached in 0.5s, not 6s",
      () => {
        // 12s loop: phase 0.5 (mid-animation) is reached after 6 real seconds.
        setDuration( 12 );
        time.elapsed = 6000;
        const drawAt12s = time.drawSeconds();

        // 1s loop: the SAME mid-animation point is reached after only 0.5s.
        setDuration( 1 );
        time.elapsed = 500;
        const drawAt1s = time.drawSeconds();

        // Both sit at the same point in the animation (phase 0.5 → 6 draw-seconds)…
        expect( drawAt1s ).toBeCloseTo(
          drawAt12s,
          6
        );
        expect( drawAt1s ).toBeCloseTo(
          0.5 * DURATION_DEFAULT,
          6
        );

        // …but the 1s loop advances the draw clock 12x faster in wall-clock
        // terms: DURATION_DEFAULT draw-seconds per `duration` real seconds.
        const ratePerSecondAt1s = drawAt1s / 0.5;
        const ratePerSecondAt12s = drawAt12s / 6;

        expect( ratePerSecondAt12s ).toBeCloseTo(
          DURATION_DEFAULT / 12,
          6
        );
        expect( ratePerSecondAt1s ).toBeCloseTo(
          DURATION_DEFAULT / 1,
          6
        );
        expect( ratePerSecondAt1s ).toBeCloseTo(
          ratePerSecondAt12s * 12,
          6
        );
      }
    );

    test(
      "the draw clock wraps every `duration` seconds during live playback",
      () => {
        setDuration( 4 );

        time.elapsed = 1000; // 1s → quarter way
        expect( time.drawSeconds() ).toBeCloseTo(
          0.25 * DURATION_DEFAULT,
          6
        );

        time.elapsed = 5000; // 5s → one full loop + 1s → back to quarter way
        expect( time.drawSeconds() ).toBeCloseTo(
          0.25 * DURATION_DEFAULT,
          6
        );
      }
    );

    test(
      "progression delegates to the canonical phase",
      () => {
        setDuration( 8 );
        time.elapsed = 2000; // 2s into an 8s loop → phase 0.25

        expect( animation.progression ).toBeCloseTo(
          time.phase(),
          10
        );
        expect( time.phase() ).toBeCloseTo(
          0.25,
          6
        );
      }
    );

    test(
      "during recording the phase does not wrap (matches the frame index)",
      () => {
        setDuration( 4 );
        window.enableRecordingMode!();

        // Recording clock is pinned to frame / framerate; the last frame of a
        // 4s @60fps loop sits just under a full loop (no wrap).
        const totalFrames = 4 * 60;

        window.setRecordingFrame!( totalFrames - 1 );
        time.incrementElapsedTime();

        expect( time.phase() ).toBeCloseTo(
          ( totalFrames - 1 ) / totalFrames,
          6
        );
        expect( time.phase() ).toBeLessThan( 1 );
        // The draw clock spans the full baseline within the clip.
        expect( time.drawSeconds() ).toBeLessThan( DURATION_DEFAULT );
      }
    );
  }
);
