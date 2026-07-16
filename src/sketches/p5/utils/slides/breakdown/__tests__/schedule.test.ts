/**
 * Covers the breakdown timeline model:
 *   - intro | build | outro phase boundaries and clamping
 *   - strictly sequential windows tiling the build span exactly
 *   - holdRatio front-loading (lockAt before window end)
 *   - currentStep / stepLocalT resolution (narration cursor)
 *   - progression wrapping (recording clock climbs past 1)
 *   - easing applied to step progress
 */

import {
  buildBreakdownSchedule,
  resolveBreakdownProgress,
  wrapProgression
} from "../schedule.js";

const build = ( overrides = {} ) => ( {
  introRatio: 0.1,
  outroRatio: 0.1,
  holdRatio: 0,
  ...overrides
} );

describe(
  "wrapProgression",
  () => {
    it(
      "folds the monotonic recording clock back into [0,1)",
      () => {
        expect( wrapProgression( 0.25 ) ).toBeCloseTo( 0.25 );
        expect( wrapProgression( 1.25 ) ).toBeCloseTo( 0.25 );
        expect( wrapProgression( -0.25 ) ).toBeCloseTo( 0.75 );
        expect( wrapProgression( 2 ) ).toBe( 0 );
      }
    );
  }
);

describe(
  "buildBreakdownSchedule",
  () => {
    it(
      "reserves intro and outro spans (defaults: intro 0, outro 0.1)",
      () => {
        const schedule = buildBreakdownSchedule(
          3,
          {}
        );

        expect( schedule.introEnd ).toBe( 0 );
        expect( schedule.outroStart ).toBeCloseTo( 0.9 );
        expect( schedule.windows ).toHaveLength( 3 );
      }
    );

    it(
      "windows tile the build span exactly, strictly sequential",
      () => {
        const schedule = buildBreakdownSchedule(
          4,
          build()
        );
        const {
          windows
        } = schedule;

        expect( windows[ 0 ].start ).toBeCloseTo( schedule.introEnd );
        expect( windows[ 3 ].end ).toBeCloseTo( schedule.outroStart );

        for ( let i = 1; i < windows.length; i++ ) {
          expect( windows[ i ].start ).toBeCloseTo( windows[ i - 1 ].end );
        }
      }
    );

    it(
      "holdRatio locks each step before its window ends",
      () => {
        const schedule = buildBreakdownSchedule(
          2,
          build( {
            holdRatio: 0.5
          } )
        );

        for ( const window of schedule.windows ) {
          expect( window.lockAt ).toBeCloseTo( window.start + ( window.end - window.start ) * 0.5 );
        }
      }
    );

    it(
      "keeps a minimum build span when intro + outro over-reserve",
      () => {
        const squeezed = buildBreakdownSchedule(
          2,
          build( {
            introRatio: 0.3,
            outroRatio: 0.6
          } )
        );

        expect( squeezed.outroStart - squeezed.introEnd ).toBeCloseTo( 0.2 );
      }
    );

    it(
      "0 steps yields no windows; a single step spans the whole build",
      () => {
        expect( buildBreakdownSchedule(
          0,
          build()
        ).windows ).toHaveLength( 0 );

        const single = buildBreakdownSchedule(
          1,
          build()
        );

        expect( single.windows[ 0 ].start ).toBeCloseTo( single.introEnd );
        expect( single.windows[ 0 ].end ).toBeCloseTo( single.outroStart );
      }
    );
  }
);

describe(
  "resolveBreakdownProgress",
  () => {
    const schedule = buildBreakdownSchedule(
      2,
      build()
    );

    it(
      "reports the intro phase, previewing step 0",
      () => {
        const state = resolveBreakdownProgress(
          schedule,
          0.05
        );

        expect( state.phase ).toBe( "intro" );
        expect( state.phaseT ).toBeCloseTo( 0.5 );
        expect( state.stepT ).toEqual( [
          0,
          0
        ] );
        expect( state.currentStep ).toBe( 0 );
        expect( state.stepLocalT ).toBe( 0 );
      }
    );

    it(
      "reports the outro with every step locked, pinned to the last step",
      () => {
        const state = resolveBreakdownProgress(
          schedule,
          0.95
        );

        expect( state.phase ).toBe( "outro" );
        expect( state.stepT ).toEqual( [
          1,
          1
        ] );
        expect( state.lockedCount ).toBe( 2 );
        expect( state.currentStep ).toBe( 1 );
        expect( state.stepLocalT ).toBe( 1 );
      }
    );

    it(
      "tracks the current step and its local position mid-build",
      () => {
        // Two windows over [0.1, 0.9]: first is [0.1, 0.5].
        const state = resolveBreakdownProgress(
          schedule,
          0.3
        );

        expect( state.phase ).toBe( "build" );
        expect( state.currentStep ).toBe( 0 );
        expect( state.stepLocalT ).toBeCloseTo( 0.5 );
        expect( state.activeIndices ).toEqual( [
          0
        ] );
        expect( state.stepT[ 1 ] ).toBe( 0 );

        const later = resolveBreakdownProgress(
          schedule,
          0.7
        );

        expect( later.currentStep ).toBe( 1 );
        expect( later.stepLocalT ).toBeCloseTo( 0.5 );
        expect( later.lockedCount ).toBe( 1 );
      }
    );

    it(
      "stepLocalT keeps advancing past lockAt while stepT holds at 1",
      () => {
        const held = buildBreakdownSchedule(
          1,
          build( {
            introRatio: 0,
            outroRatio: 0,
            holdRatio: 0.5
          } )
        );
        const state = resolveBreakdownProgress(
          held,
          0.75
        );

        expect( state.stepT[ 0 ] ).toBe( 1 ); // locked at 0.5
        expect( state.stepLocalT ).toBeCloseTo( 0.75 ); // narration continues
      }
    );

    it(
      "applies easing to the eased track but not the raw one",
      () => {
        const square = ( x: number ) => x * x;
        const state = resolveBreakdownProgress(
          schedule,
          0.3,
          square
        );

        expect( state.stepT[ 0 ] ).toBeCloseTo( state.rawStepT[ 0 ] ** 2 );
      }
    );

    it(
      "wraps a monotonic recording progression",
      () => {
        const wrapped = resolveBreakdownProgress(
          schedule,
          1.3
        );
        const direct = resolveBreakdownProgress(
          schedule,
          0.3
        );

        expect( wrapped ).toEqual( direct );
      }
    );
  }
);
