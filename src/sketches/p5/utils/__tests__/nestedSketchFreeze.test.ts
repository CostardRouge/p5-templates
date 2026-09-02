/**
 * @jest-environment jsdom
 *
 * Freezing and offsetting an embedded sketch layer ("sketch" content item).
 *
 * A layer can sit somewhere else in the loop than the page does: `progression`
 * moves its loop origin, and `play: false` freezes it on the frame that origin
 * selects. Two things have to hold for that to be a design control rather than
 * a rendering artefact, and both are tested here:
 *
 *  - a layer at its defaults installs NO override, so it reads the host clock
 *    verbatim — including during capture, where `time.phase()` deliberately
 *    climbs past 1 instead of wrapping;
 *  - the override reaches the whole module graph through `time.phase()`, the
 *    one value `animation.progression` and the `draw( time, … )` argument are
 *    both derived from, so no sketch and no helper needs to know about it.
 */

export {};

/* eslint-disable @typescript-eslint/no-require-imports */
const time = require( "@/p5/utils/time.js" ).default;
const {
  pushPhaseOverride, popPhaseOverride
} = require( "@/p5/utils/time.js" );
const animation = require( "@/p5/utils/animation.js" ).default;
const sketch = require( "@/p5/utils/sketch.js" ).default;
const {
  layerPhase
} = require( "@/p5/utils/nestedSketch.js" );
const {
  DURATION_DEFAULT
} = require( "@/lib/animationConfig" );
/* eslint-enable @typescript-eslint/no-require-imports */

describe(
  "layerPhase",
  () => {
    it(
      "leaves a layer at its defaults following the host, with no override",
      () => {
        expect( layerPhase(
          0.25,
          {
            play: true,
            progression: 0
          }
        ) ).toBeNull();
        expect( layerPhase(
          0.25,
          {}
        ) ).toBeNull();
      }
    );

    it(
      "freezes on the progression, whatever the host is doing",
      () => {
        const item = {
          play: false,
          progression: 0.4
        };

        expect( layerPhase(
          0,
          item
        ) ).toBeCloseTo( 0.4 );
        expect( layerPhase(
          0.97,
          item
        ) ).toBeCloseTo( 0.4 );
      }
    );

    it(
      "offsets a playing layer inside the same 0..1 loop",
      () => {
        const item = {
          play: true,
          progression: 0.5
        };

        expect( layerPhase(
          0.1,
          item
        ) ).toBeCloseTo( 0.6 );
        // Wrapped: an offset layer runs ahead of the page in the same loop, and
        // `animation.progression` is a 0..1 value everywhere.
        expect( layerPhase(
          0.8,
          item
        ) ).toBeCloseTo( 0.3 );
      }
    );

    it(
      "is a pure function of the host phase, so capture and preview agree",
      () => {
        const item = {
          play: true,
          progression: 0.25
        };

        expect( layerPhase(
          0.61,
          item
        ) ).toBe( layerPhase(
          0.61,
          item
        ) );
      }
    );

    it(
      "clamps a progression outside the loop rather than drifting",
      () => {
        expect( layerPhase(
          0.5,
          {
            play: false,
            progression: 4
          }
        ) ).toBe( 1 );
        expect( layerPhase(
          0.5,
          {
            play: false,
            progression: -2
          }
        ) ).toBe( 0 );
        expect( layerPhase(
          0.5,
          {
            play: false,
            progression: Number.NaN
          }
        ) ).toBe( 0 );
      }
    );
  }
);

describe(
  "the loop-phase override",
  () => {
    beforeEach( () => {
      window.disableRecordingMode!();
      time.reset();
      sketch.sketchOptions = {
        size: {
          width: 1080,
          height: 1350
        },
        animation: {
          framerate: 60,
          duration: DURATION_DEFAULT
        }
      };
    } );

    afterEach( () => {
      popPhaseOverride( null );
    } );

    it(
      "moves every reader of the loop phase at once",
      () => {
        time.elapsed = ( DURATION_DEFAULT / 4 ) * 1000; // a quarter through

        expect( animation.progression ).toBeCloseTo( 0.25 );

        pushPhaseOverride( 0.75 );

        expect( time.phase() ).toBeCloseTo( 0.75 );
        expect( animation.progression ).toBeCloseTo( 0.75 );
        expect( animation.loopTime ).toBeCloseTo( 0.75 * DURATION_DEFAULT );
        expect( time.drawSeconds() ).toBeCloseTo( 0.75 * DURATION_DEFAULT );
      }
    );

    it(
      "leaves the wall clock alone — it overrides the loop, not `millis()`",
      () => {
        time.elapsed = 5000;
        pushPhaseOverride( 0 );

        expect( time.seconds() ).toBeCloseTo( 5 );
      }
    );

    it(
      "restores the host's phase, including a 0 the nullish idiom would drop",
      () => {
        time.elapsed = ( DURATION_DEFAULT / 2 ) * 1000;

        const outer = pushPhaseOverride( 0 );
        const inner = pushPhaseOverride( 0.9 );

        popPhaseOverride( inner );
        expect( time.phase() ).toBe( 0 );

        popPhaseOverride( outer );
        expect( time.phase() ).toBeCloseTo( 0.5 );
      }
    );
  }
);
