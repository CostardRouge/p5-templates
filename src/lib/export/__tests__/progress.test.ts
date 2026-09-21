/**
 * The export progress model, which exists to stop a bar lying about a run.
 *
 * Two properties carry the whole design and both were broken before it:
 *
 *   - a variant's progress reaches 1 whatever phases it goes through, so a
 *     still — which never encodes — does not stop at 80%,
 *   - and it only ever goes up, so a phase change cannot make the row's fill
 *     jump backwards.
 *
 * The third is the one the old code failed most visibly: capturing must not own
 * the whole 0→1, or the encode that follows has nowhere to go and sits pinned
 * at 100% for as long as it takes.
 */

import {
  EXPORT_PHASES, phaseFraction, phasesFor, type ExportPhase
} from "../progress";

describe(
  "phasesFor",
  () => {
    it(
      "gives video every phase",
      () => {
        expect( phasesFor( "video" ) ).toEqual( [
          ...EXPORT_PHASES
        ] );
      }
    );

    it(
      "leaves encoding out of the kinds that never encode",
      () => {
        expect( phasesFor( "image" ) ).not.toContain( "encoding" );
        expect( phasesFor( "frames" ) ).not.toContain( "encoding" );
      }
    );
  }
);

describe(
  "phaseFraction",
  () => {
    it.each( [
      "video",
      "image",
      "frames"
    ] as const )(
      "runs from 0 to 1 across %s's own phases",
      ( kind ) => {
        const phases = phasesFor( kind );

        expect( phaseFraction(
          phases,
          phases[ 0 ],
          0
        ) ).toBe( 0 );
        expect( phaseFraction(
          phases,
          phases[ phases.length - 1 ],
          1
        ) ).toBe( 1 );
      }
    );

    it(
      "never goes backwards as a variant advances",
      () => {
        const phases = phasesFor( "video" );
        const readings = phases.flatMap( ( phase ) => [
          0,
          0.5,
          1
        ].map( ( within ) => phaseFraction(
          phases,
          phase,
          within
        ) ) );

        const sorted = [
          ...readings
        ].sort( (
          a, b
        ) => a - b );

        expect( readings ).toEqual( sorted );
      }
    );

    it(
      "leaves room after capturing for the phases that follow it",
      () => {
        const phases = phasesFor( "video" );

        // The bug this pins: capturing used to report 0-100 of the whole
        // variant, so "Encoding…" could only be drawn at 100%.
        expect( phaseFraction(
          phases,
          "capturing",
          1
        ) ).toBeLessThan( 0.9 );
      }
    );

    it(
      "gives a still's capture the room an mp4 spends encoding",
      () => {
        // Normalising over the phases that apply is what keeps a still honest:
        // the same weights, redistributed, rather than a dead segment sitting
        // there never filling.
        const still = phaseFraction(
          phasesFor( "image" ),
          "capturing",
          1
        );

        expect( still ).toBeGreaterThan( phaseFraction(
          phasesFor( "video" ),
          "capturing",
          1
        ) );
        expect( still ).toBeLessThan( 1 );
      }
    );

    it(
      "treats an unknown phase and a broken number as no progress",
      () => {
        const phases = phasesFor( "image" );

        expect( phaseFraction(
          phases,
          "encoding" as ExportPhase,
          1
        ) ).toBe( 0 );
        expect( phaseFraction(
          phases,
          "capturing",
          Number.NaN
        ) ).toBe( phaseFraction(
          phases,
          "capturing",
          0
        ) );
      }
    );
  }
);
