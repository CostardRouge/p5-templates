/**
 * @jest-environment jsdom
 *
 * Regression tests for the deterministic recording clock.
 *
 * Browser async-loop capture used to let the sketch clock advance on
 * wall-clock `millis()` deltas while the encoder stepped the frame index, so
 * the captured animation drifted out of sync with the loop (finishing early on
 * fast machines, late on slow ones). In recording mode `time.elapsed` must be a
 * pure function of the pinned frame index: t = frame / framerate.
 */

export {};

/* eslint-disable @typescript-eslint/no-require-imports */
const time = require( "@/p5/utils/time.js" ).default;
const sketch = require( "@/p5/utils/sketch.js" ).default;
/* eslint-enable @typescript-eslint/no-require-imports */

const FRAMERATE = 30;
const DURATION = 4;

describe(
  "deterministic recording clock",
  () => {
    beforeEach( () => {
      sketch.sketchOptions = {
        size: {
          width: 1080,
          height: 1350
        },
        animation: {
          framerate: FRAMERATE,
          duration: DURATION
        }
      };
      window.disableRecordingMode!();
      time.reset();
    } );

    test(
      "pinned frame index drives elapsed time at frame / framerate",
      () => {
        window.enableRecordingMode!();

        const totalFrames = FRAMERATE * DURATION;

        for ( let frame = 0; frame < totalFrames; frame++ ) {
          window.setRecordingFrame!( frame );
          // Stands in for the pre-draw step the p5 loop runs each redraw.
          time.incrementElapsedTime();
          expect( time.seconds() ).toBeCloseTo(
            frame / FRAMERATE,
            6
          );
        }
      }
    );

    test(
      "re-pinning the same frame is idempotent — no wall-clock drift",
      () => {
        window.enableRecordingMode!();

        window.setRecordingFrame!( 10 );
        time.incrementElapsedTime();
        const first = time.seconds();

        // Drawing the same frame again must not advance the clock.
        window.setRecordingFrame!( 10 );
        time.incrementElapsedTime();

        expect( time.seconds() ).toBeCloseTo(
          first,
          6
        );
        expect( time.seconds() ).toBeCloseTo(
          10 / FRAMERATE,
          6
        );
      }
    );

    test(
      "the last captured frame lands just under a full loop",
      () => {
        window.enableRecordingMode!();

        const totalFrames = FRAMERATE * DURATION;
        const lastFrame = totalFrames - 1;

        window.setRecordingFrame!( lastFrame );
        time.incrementElapsedTime();

        const progression = window.getAnimationProgression!();

        // The wrap frame (progression === 1) is the same as frame 0, so the
        // last captured frame sits one step below it — a clean, seamless loop.
        expect( progression ).toBeCloseTo(
          lastFrame / totalFrames,
          6
        );
        expect( progression ).toBeLessThan( 1 );
      }
    );

    test(
      "outside recording mode the pinned frame index is ignored",
      () => {
        // No recording mode + no p5 engine clock → elapsed stays put, proving
        // the pin only takes effect during deterministic capture.
        window.setRecordingFrame!( 100 );
        time.incrementElapsedTime();

        expect( time.seconds() ).toBe( 0 );
      }
    );
  }
);
