/**
 * Behavioural tests for the breakdown sound scheduler: the lock-edge detection
 * that turns each parameter settling into a click, the clean intro (no click on
 * first sighting), the per-loop re-fire when values relock, and the
 * backwards-clock reset that keeps deterministic captures from being silenced
 * by editing-session state.
 *
 * The scheduler polls a caller-provided clock and delegates the actual queueing
 * to an injected specs scheduler, so no Web Audio (or audio engine import) is
 * needed here.
 */

// The module chain (breakdownSound → specsSound) imports the audio engine only
// for its default instance; stub it so the sketch/p5 import chain never loads.
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
  createBreakdownSoundScheduler
} from "../breakdownSound.js";
import {
  createSpecsSoundScheduler
} from "../specsSound.js";

const baseSound = {
  enabled: true,
  preset: "click",
  volume: 0.5,
  pitch: 1,
  pitchVariation: 0,
  linePitchSpread: 0,
  minInterval: 0.05,
  lineCooldown: 0.15,
  maxBurst: 12,
  repeat: {
    mode: "once"
  }
};

function makeScheduler() {
  const fired: any[] = [];
  const inner = createSpecsSoundScheduler(
    ( params: any ) => fired.push( params ),
    () => 0.5 // deterministic "random"
  );
  const scheduler = createBreakdownSoundScheduler( inner );

  return {
    fired,
    scheduler
  };
}

const oneStep = ( paths: string[] ) => [
  {
    paths
  }
];

const leafMap = ( entries: Record<string, number> ) => new Map( Object.entries( entries ) );

describe(
  "createBreakdownSoundScheduler",
  () => {
    it(
      "clicks when a leaf locks (progress crosses to 1)",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();
        const animSteps = oneStep( [
          "count"
        ] );

        // First sighting mid-animation: baseline only, no click.
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 0.4
            } ),
            now: 1
          }
        );
        expect( fired ).toHaveLength( 0 );

        // Still animating: no click.
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 0.9
            } ),
            now: 1.02
          }
        );
        expect( fired ).toHaveLength( 0 );

        // Locks this frame: one click, due immediately.
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 1
            } ),
            now: 1.04
          }
        );
        expect( fired ).toHaveLength( 1 );
        expect( fired[ 0 ] ).toMatchObject( {
          preset: "click",
          gain: 0.5,
          rate: 1
        } );
      }
    );

    it(
      "never clicks on a first sighting that is already locked (clean intro)",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();
        const animSteps = oneStep( [
          "seed"
        ] );

        // A leaf already at 1 when first seen (a past step) never animated.
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              seed: 1
            } ),
            now: 1
          }
        );
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              seed: 1
            } ),
            now: 1.02
          }
        );

        expect( fired ).toHaveLength( 0 );
      }
    );

    it(
      "re-fires on the next loop when a locked leaf relocks",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();
        const animSteps = oneStep( [
          "count"
        ] );

        // Lock during loop 1.
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 0.5
            } ),
            now: 1
          }
        );
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 1
            } ),
            now: 1.1
          }
        );
        expect( fired ).toHaveLength( 1 );

        // Loop wraps: the value unlocks (progress falls) then locks again.
        // The clock keeps climbing during live playback, so this is NOT a
        // backwards-clock reset.
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 0.3
            } ),
            now: 5
          }
        );
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 1
            } ),
            now: 5.1
          }
        );
        expect( fired ).toHaveLength( 2 );
      }
    );

    it(
      "staggers simultaneous locks across a step by minInterval",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();
        const animSteps = oneStep( [
          "a",
          "b",
          "c"
        ] );

        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              a: 0.5,
              b: 0.5,
              c: 0.5
            } ),
            now: 1
          }
        );
        // All three lock on the same frame — staggered, not stacked.
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              a: 1,
              b: 1,
              c: 1
            } ),
            now: 1.1
          }
        );
        expect( fired ).toHaveLength( 1 );

        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              a: 1,
              b: 1,
              c: 1
            } ),
            now: 1.16
          }
        );
        expect( fired ).toHaveLength( 2 );

        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              a: 1,
              b: 1,
              c: 1
            } ),
            now: 1.3
          }
        );
        expect( fired ).toHaveLength( 3 );
      }
    );

    it(
      "spreads pitch across the whole breakdown in octaves",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();
        const sound = {
          ...baseSound,
          linePitchSpread: 1
        };
        // Two steps, three leaves total: first and last span one octave.
        const animSteps = [
          {
            paths: [
              "first",
              "middle"
            ]
          },
          {
            paths: [
              "last"
            ]
          }
        ];

        scheduler.noteFrame(
          sound,
          {
            animSteps,
            leafT: leafMap( {
              first: 0.5,
              middle: 0.5,
              last: 0.5
            } ),
            now: 1
          }
        );
        // Lock the first leaf.
        scheduler.noteFrame(
          sound,
          {
            animSteps,
            leafT: leafMap( {
              first: 1,
              middle: 0.5,
              last: 0.5
            } ),
            now: 1.1
          }
        );
        // Lock the last leaf a beat later (past the cooldown).
        scheduler.noteFrame(
          sound,
          {
            animSteps,
            leafT: leafMap( {
              first: 1,
              middle: 0.5,
              last: 1
            } ),
            now: 2
          }
        );

        expect( fired[ 0 ].rate ).toBeCloseTo( 1 );
        expect( fired[ 1 ].rate ).toBeCloseTo( 2 );
      }
    );

    it(
      "resets its edge state when the clock jumps backwards (capture restart)",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();
        const animSteps = oneStep( [
          "count"
        ] );

        // Editing session far in the future: lock once.
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 0.5
            } ),
            now: 500
          }
        );
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 1
            } ),
            now: 500.1
          }
        );
        expect( fired ).toHaveLength( 1 );

        // Deterministic capture resets the sketch clock to ~0. The first
        // post-reset frame rebaselines (no click), even though it is locked…
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 1
            } ),
            now: 0.05
          }
        );
        expect( fired ).toHaveLength( 1 );

        // …and the next real lock clicks again.
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 0.4
            } ),
            now: 0.1
          }
        );
        scheduler.noteFrame(
          baseSound,
          {
            animSteps,
            leafT: leafMap( {
              count: 1
            } ),
            now: 0.2
          }
        );
        expect( fired ).toHaveLength( 2 );
      }
    );
  }
);
