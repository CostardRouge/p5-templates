/**
 * Behavioural tests for the montage transition sound scheduler: it fires a hit
 * only when the arriving variant advances (never on first appearance), supports
 * an N-hit burst, spreads pitch by variant index, and resets its change
 * baseline when the sketch clock jumps backwards (capture restart / deck reset)
 * so a rewind never mis-fires.
 *
 * The scheduler polls a caller-provided clock and takes an injected trigger,
 * so no Web Audio (or audio engine import) is needed here.
 */

// The module under test imports the audio engine only for its default
// instance; stub it so the sketch/p5 import chain never loads in node.
jest.mock(
  "../../../audio.js",
  () => ( {
    __esModule: true,
    default: {
      trigger: jest.fn()
    }
  } )
);

import {
  createMontageSoundScheduler
} from "../montageSound.js";

const baseOption = {
  enabled: true,
  preset: "blip",
  volume: 0.5,
  pitch: 1,
  pitchVariation: 0,
  slidePitchSpread: 0,
  repeat: {
    mode: "once"
  }
};

function makeScheduler() {
  const fired: any[] = [];
  const scheduler = createMontageSoundScheduler(
    ( params: any ) => fired.push( params ),
    () => 0.5 // deterministic "random"
  );

  return {
    fired,
    scheduler
  };
}

describe(
  "createMontageSoundScheduler",
  () => {
    it(
      "does not fire on the first observed frame (appearing is not a transition)",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        scheduler.update(
          1,
          baseOption,
          {
            activeIndex: 0,
            count: 3
          }
        );

        expect( fired ).toHaveLength( 0 );
      }
    );

    it(
      "fires one hit when the active variant advances",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        scheduler.update(
          1,
          baseOption,
          {
            activeIndex: 0,
            count: 3
          }
        );
        scheduler.update(
          1.5,
          baseOption,
          {
            activeIndex: 1,
            count: 3
          }
        );

        expect( fired ).toHaveLength( 1 );
        expect( fired[ 0 ] ).toMatchObject( {
          preset: "blip",
          gain: 0.5,
          rate: 1
        } );
      }
    );

    it(
      "does not re-fire while the active variant is unchanged",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        scheduler.update(
          1,
          baseOption,
          {
            activeIndex: 0,
            count: 3
          }
        );
        scheduler.update(
          1.1,
          baseOption,
          {
            activeIndex: 1,
            count: 3
          }
        );
        scheduler.update(
          1.2,
          baseOption,
          {
            activeIndex: 1,
            count: 3
          }
        );

        expect( fired ).toHaveLength( 1 );
      }
    );

    it(
      "plays a burst of `times` hits spaced by `interval` in count mode",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        const option = {
          ...baseOption,
          repeat: {
            mode: "count",
            times: 3,
            interval: 0.06,
            pitchStep: 0
          }
        };

        scheduler.update(
          1,
          option,
          {
            activeIndex: 0,
            count: 3
          }
        );
        // Advance -> enqueue burst; only the first hit is due at t=1.5.
        scheduler.update(
          1.5,
          option,
          {
            activeIndex: 1,
            count: 3
          }
        );
        expect( fired ).toHaveLength( 1 );

        scheduler.update(
          1.56,
          option,
          {
            activeIndex: 1,
            count: 3
          }
        );
        expect( fired ).toHaveLength( 2 );

        scheduler.update(
          1.62,
          option,
          {
            activeIndex: 1,
            count: 3
          }
        );
        expect( fired ).toHaveLength( 3 );
      }
    );

    it(
      "ramps burst pitch by pitchStep octaves per hit",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        const option = {
          ...baseOption,
          repeat: {
            mode: "count",
            times: 2,
            interval: 0.05,
            pitchStep: 0.5
          }
        };

        scheduler.update(
          1,
          option,
          {
            activeIndex: 0,
            count: 3
          }
        );
        scheduler.update(
          1.5,
          option,
          {
            activeIndex: 1,
            count: 3
          }
        );
        scheduler.update(
          1.55,
          option,
          {
            activeIndex: 1,
            count: 3
          }
        );

        expect( fired ).toHaveLength( 2 );
        // Second hit is a half-octave up: 2^0.5 ≈ 1.4142.
        expect( fired[ 1 ].rate / fired[ 0 ].rate ).toBeCloseTo(
          Math.SQRT2,
          5
        );
      }
    );

    it(
      "gives each arriving variant its own note via slidePitchSpread",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        const option = {
          ...baseOption,
          slidePitchSpread: 1 // one octave across the whole montage
        };

        scheduler.update(
          1,
          option,
          {
            activeIndex: 0,
            count: 3
          }
        );
        scheduler.update(
          1.5,
          option,
          {
            activeIndex: 2,
            count: 3
          }
        );

        // Arriving at the last of 3 variants -> full octave up: rate ≈ 2.
        expect( fired ).toHaveLength( 1 );
        expect( fired[ 0 ].rate ).toBeCloseTo(
          2,
          5
        );
      }
    );

    it(
      "resets its change baseline when the clock jumps backwards",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        scheduler.update(
          5,
          baseOption,
          {
            activeIndex: 0,
            count: 3
          }
        );
        scheduler.update(
          5.5,
          baseOption,
          {
            activeIndex: 1,
            count: 3
          }
        );
        expect( fired ).toHaveLength( 1 );

        // Capture restart: clock rewinds to 0. The first frame after the reset
        // re-establishes the baseline and must NOT fire.
        scheduler.update(
          0,
          baseOption,
          {
            activeIndex: 1,
            count: 3
          }
        );
        expect( fired ).toHaveLength( 1 );

        // Subsequent advances fire normally again.
        scheduler.update(
          0.5,
          baseOption,
          {
            activeIndex: 2,
            count: 3
          }
        );
        expect( fired ).toHaveLength( 2 );
      }
    );
  }
);
