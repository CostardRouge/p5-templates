import {
  allCandidates, findCandidate, onStep, proposeVariations
} from "../propose";
import {
  checkSketchOptions
} from "../../../../scripts/mcp/sketchForm";
import * as smoke from "../../../sketches/p5/sketches/materials/materials-v7-smoke/options";

const slider = (
  min: number, max: number, step: number, label?: string
) => ( {
  component: "slider",
  min,
  max,
  step,
  ...( label
    ? {
      label
    }
    : {} )
} );

const FORM = {
  seed: slider(
    0,
    999,
    1,
    "Seed"
  ),
  timeScale: slider(
    0.1,
    4,
    0.1
  ),
  render: {
    component: "nested-object",
    fields: {
      palette: {
        component: "palette-picker",
        label: "Palette",
        options: [
          {
            value: "original",
            label: "Original"
          },
          {
            value: "sunset",
            label: "Sunset"
          },
          {
            value: "riso",
            label: "Riso"
          },
          {
            value: "chrome",
            label: "Chrome"
          }
        ]
      },
      mode: {
        component: "select",
        label: "Mode",
        options: [
          "circle",
          "lissajous",
          "sweep"
        ]
      },
      count: slider(
        1,
        200,
        1,
        "Count"
      ),
      phase: slider(
        0,
        1,
        0.01
      ),
      outline: {
        component: "checkbox",
        label: "Outline"
      },
      title: {
        component: "text"
      }
    }
  },
  hoverSound: {
    component: "nested-object",
    fields: {
      volume: slider(
        0,
        1,
        0.01
      )
    }
  },
  interaction: {
    component: "nested-object",
    fields: {
      strength: slider(
        0,
        1,
        0.01
      )
    }
  },
  secret: {
    component: "hidden"
  }
};

const VALUES = {
  seed: 998,
  timeScale: 1,
  render: {
    palette: "original",
    mode: "circle",
    count: 40,
    phase: 0.4,
    outline: false,
    title: "orbit"
  },
  hoverSound: {
    volume: 0.5
  },
  interaction: {
    strength: 0.5
  },
  secret: 1
};

describe(
  "proposeVariations",
  () => {
    it(
      "takes the moves in turn, so a small grid shows different kinds of change",
      () => {
        expect( proposeVariations(
          FORM,
          VALUES,
          5
        ).map( ( c ) => [
          c.move,
          c.label
        ] ) ).toEqual( [
          [
            "palette",
            "Palette: Riso"
          ],
          [
            "choice",
            "Mode: lissajous"
          ],
          [
            "amount",
            "Count 40 → 160"
          ],
          [
            "seed",
            "Seed 998 → 999"
          ],
          [
            "toggle",
            "Outline: on"
          ]
        ] );
      }
    );

    it(
      "writes each candidate as the nested delta sketch.set takes, and says what it changes",
      () => {
        const [
          palette
        ] = proposeVariations(
          FORM,
          VALUES,
          1
        );

        expect( palette ).toEqual( {
          id: "palette:render.palette=riso",
          move: "palette",
          label: "Palette: Riso",
          values: {
            render: {
              palette: "riso"
            }
          },
          changes: [
            {
              path: "render.palette",
              from: "original",
              to: "riso"
            }
          ]
        } );
      }
    );

    it(
      "never touches words, sound, the pointer's settings nor a hidden field",
      () => {
        const paths = Object.values( allCandidates(
          FORM,
          VALUES
        ) ).flat()
          .flatMap( ( c ) => c.changes.map( ( change ) => change.path ) );

        expect( paths.some( ( path ) => /title|hoverSound|interaction|secret/.test( path ) ) ).toBe( false );
      }
    );

    it(
      "puts the sliders that shape the piece before the ones that only shift it",
      () => {
        const amounts = allCandidates(
          FORM,
          VALUES
        ).amount.map( ( c ) => c.id );

        expect( amounts.indexOf( "high:render.count" ) ).toBeLessThan( amounts.indexOf( "high:timeScale" ) );
        expect( amounts.indexOf( "high:timeScale" ) ).toBeLessThan( amounts.indexOf( "high:render.phase" ) );
        // A second end of the same slider comes after every first one; an end too close to the value is not a move.
        expect( amounts[ amounts.length - 1 ] ).toBe( "low:render.phase" );
        expect( amounts ).not.toContain( "low:render.count" );
      }
    );

    it(
      "keeps a seed inside its range, wrapping at the end",
      () => {
        expect( allCandidates(
          FORM,
          VALUES
        ).seed.map( ( c ) => c.changes[ 0 ].to ) ).toEqual( [
          999,
          0,
          1
        ] );
      }
    );

    it(
      "is the same list for the same form, so an id finds its candidate again",
      () => {
        const first = proposeVariations(
          FORM,
          VALUES,
          12
        );

        expect( proposeVariations(
          FORM,
          VALUES,
          12
        ) ).toEqual( first );
        expect( new Set( first.map( ( c ) => c.id ) ).size ).toBe( first.length );
        expect( findCandidate(
          FORM,
          VALUES,
          first[ 7 ].id
        ) ).toEqual( first[ 7 ] );
        expect( findCandidate(
          FORM,
          VALUES,
          "palette:render.palette=nope"
        ) ).toBeNull();
      }
    );

    it(
      "snaps an amount to the slider's own steps",
      () => {
        expect( onStep(
          0.337,
          0,
          1,
          0.05
        ) ).toBe( 0.35 );
        expect( onStep(
          250,
          1,
          200,
          1
        ) ).toBe( 200 );
        expect( onStep(
          0.8,
          0.1,
          4,
          0.1
        ) ).toBe( 0.8 );
      }
    );

    it(
      "proposes only what a real sketch's own form accepts",
      () => {
        const candidates = proposeVariations(
          smoke.formConfiguration,
          smoke.formValues,
          12
        );

        expect( candidates.length ).toBeGreaterThanOrEqual( 6 );
        for ( const c of candidates ) {
          expect( () => checkSketchOptions(
            smoke.formConfiguration as Record<string, unknown>,
            smoke.formValues as Record<string, unknown>,
            c.values
          ) ).not.toThrow();
        }
      }
    );
  }
);
