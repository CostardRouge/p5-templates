/**
 * Behavioural tests for the specs sound scheduler: staggering, per-line
 * cooldown, burst cap, repeat modes and the backwards-clock reset that keeps
 * deterministic captures from being silenced by editing-session state.
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
  createSpecsSoundScheduler
} from "../specsSound.js";
import computeSpecsHeats from "../specsChanges.js";

const baseOption = {
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
  const scheduler = createSpecsSoundScheduler(
    ( params: any ) => fired.push( params ),
    () => 0.5 // deterministic "random"
  );

  return {
    fired,
    scheduler
  };
}

describe(
  "createSpecsSoundScheduler",
  () => {
    it(
      "fires one click per change once due",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        scheduler.noteChange(
          baseOption,
          {
            label: "SEED",
            index: 0,
            lineCount: 4,
            now: 1
          }
        );

        expect( fired ).toHaveLength( 0 );

        scheduler.update( 1 );

        expect( fired ).toHaveLength( 1 );
        expect( fired[ 0 ] ).toMatchObject( {
          preset: "click",
          gain: 0.5,
          rate: 1
        } );
      }
    );

    it(
      "staggers simultaneous changes by minInterval",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        for ( const label of [
          "A",
          "B",
          "C"
        ] ) {
          scheduler.noteChange(
            baseOption,
            {
              label,
              index: 0,
              lineCount: 3,
              now: 1
            }
          );
        }

        scheduler.update( 1 );
        expect( fired ).toHaveLength( 1 );

        scheduler.update( 1.06 );
        expect( fired ).toHaveLength( 2 );

        scheduler.update( 1.2 );
        expect( fired ).toHaveLength( 3 );
      }
    );

    it(
      "applies the per-line cooldown to rapid retriggers",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        scheduler.noteChange(
          baseOption,
          {
            label: "MORPH",
            index: 0,
            lineCount: 1,
            now: 1
          }
        );
        // Same line changes again on the next frame — inside the cooldown.
        scheduler.noteChange(
          baseOption,
          {
            label: "MORPH",
            index: 0,
            lineCount: 1,
            now: 1.016
          }
        );
        scheduler.update( 1.05 );

        expect( fired ).toHaveLength( 1 );

        // Past the cooldown it clicks again.
        scheduler.noteChange(
          baseOption,
          {
            label: "MORPH",
            index: 0,
            lineCount: 1,
            now: 1.2
          }
        );
        scheduler.update( 1.3 );

        expect( fired ).toHaveLength( 2 );
      }
    );

    it(
      "schedules a rising burst in count mode",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        scheduler.noteChange(
          {
            ...baseOption,
            repeat: {
              mode: "count",
              times: 3,
              interval: 0.1,
              pitchStep: 1 // one octave per click, easy to assert
            }
          },
          {
            label: "SEED",
            index: 0,
            lineCount: 1,
            now: 0
          }
        );

        scheduler.update( 0.25 );

        expect( fired ).toHaveLength( 3 );
        expect( fired.map( ( click ) => click.rate ) ).toEqual( [
          1,
          2,
          4
        ] );
      }
    );

    it(
      "repeats across the highlight window in while-highlighted mode",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        scheduler.noteChange(
          {
            ...baseOption,
            repeat: {
              mode: "while-highlighted",
              interval: 0.3
            }
          },
          {
            label: "SEED",
            index: 0,
            lineCount: 1,
            now: 0,
            highlightDuration: 0.9
          }
        );

        // floor(0.9 / 0.3) + 1 = 4 clicks at 0, 0.3, 0.6, 0.9 — collected by
        // stepping the clock like the per-frame caller does.
        for ( let t = 0; t <= 1.05; t += 0.05 ) {
          scheduler.update( t );
        }

        expect( fired ).toHaveLength( 4 );
      }
    );

    it(
      "caps the queue at maxBurst",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();
        const option = {
          ...baseOption,
          maxBurst: 2
        };

        for ( let i = 0; i < 5; i++ ) {
          scheduler.noteChange(
            option,
            {
              label: `L${ i }`,
              index: i,
              lineCount: 5,
              now: 1
            }
          );
        }

        scheduler.update( 1.1 );

        expect( fired ).toHaveLength( 2 );
      }
    );

    it(
      "spreads pitch across lines in octaves",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();
        const option = {
          ...baseOption,
          linePitchSpread: 1
        };

        scheduler.noteChange(
          option,
          {
            label: "FIRST",
            index: 0,
            lineCount: 3,
            now: 1
          }
        );
        scheduler.update( 1.05 );
        scheduler.noteChange(
          option,
          {
            label: "LAST",
            index: 2,
            lineCount: 3,
            now: 2
          }
        );
        scheduler.update( 2.05 );

        expect( fired[ 0 ].rate ).toBeCloseTo( 1 );
        expect( fired[ 1 ].rate ).toBeCloseTo( 2 );
      }
    );

    it(
      "drops clicks that went stale while the overlay wasn't drawn",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        scheduler.noteChange(
          baseOption,
          {
            label: "SEED",
            index: 0,
            lineCount: 1,
            now: 1
          }
        );

        // Next update only happens much later (fade-out window, hidden tab):
        // the queued click is dropped instead of fired late.
        scheduler.update( 5 );

        expect( fired ).toHaveLength( 0 );
        expect( scheduler.pending() ).toBe( 0 );
      }
    );

    it(
      "resets itself when the clock jumps backwards (capture restart)",
      () => {
        const {
          fired, scheduler
        } = makeScheduler();

        // Editing session state far in the future…
        scheduler.noteChange(
          baseOption,
          {
            label: "SEED",
            index: 0,
            lineCount: 1,
            now: 500
          }
        );
        scheduler.update( 500 );
        expect( fired ).toHaveLength( 1 );

        // …then the deterministic capture resets the sketch clock to 0.
        scheduler.noteChange(
          baseOption,
          {
            label: "SEED",
            index: 0,
            lineCount: 1,
            now: 0.1
          }
        );
        scheduler.update( 0.1 );

        expect( fired ).toHaveLength( 2 );
      }
    );
  }
);

describe(
  "computeSpecsHeats onChange callback",
  () => {
    it(
      "reports value changes but not first sightings",
      () => {
        const changes: Array<[string, number]> = [];
        const onChange = (
          label: string, index: number
        ) => changes.push( [
          label,
          index
        ] );
        const lines = ( value: string ) => [
          {
            label: "SPECS-SOUND-TEST",
            value
          }
        ];

        computeSpecsHeats(
          lines( "a" ),
          0.9,
          onChange
        );
        expect( changes ).toHaveLength( 0 );

        computeSpecsHeats(
          lines( "b" ),
          0.9,
          onChange
        );
        expect( changes ).toEqual( [
          [
            "SPECS-SOUND-TEST",
            0
          ]
        ] );

        // Unchanged value stays silent.
        computeSpecsHeats(
          lines( "b" ),
          0.9,
          onChange
        );
        expect( changes ).toHaveLength( 1 );
      }
    );
  }
);
