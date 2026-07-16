/**
 * Covers the diff-style step derivation:
 *   - selection "changed": only leaves differing from the stock defaults
 *     (relative epsilon on numbers, per-component on arrays, missing stock
 *     counts as changed); no reachable formValues → behaves as "all"
 *   - grouping: nested objects = one step each; isolated top-level leaves =
 *     their OWN step (no shared PARAMETERS gathering)
 *   - exclude-key matching, reserved-key skipping, overflow flagging
 */

import deriveBreakdownSteps, {
  MAX_ANIM_STEPS,
  classifyLeaf,
  differs,
  formConfigAt,
  matchesKeyList
} from "../deriveSteps.js";

const sketch = {
  seed: 42,
  animated: true,
  strokeColor: [
    255,
    0,
    0
  ],
  grid: {
    columns: 8,
    offset: [
      0.5,
      0.25
    ]
  },
  noise: {
    scale: 0.25,
    octaves: 3
  }
};

describe(
  "matchesKeyList",
  () => {
    it(
      "matches full dotted paths and bare leaf names",
      () => {
        expect( matchesKeyList(
          "sites.seed",
          [
            "seed"
          ]
        ) ).toBe( true );
        expect( matchesKeyList(
          "sites.seed",
          [
            "sites.seed"
          ]
        ) ).toBe( true );
        expect( matchesKeyList(
          "sites.reseed",
          [
            "seed"
          ]
        ) ).toBe( false );
      }
    );
  }
);

describe(
  "formConfigAt / classifyLeaf",
  () => {
    const formConfiguration = {
      grid: {
        component: "nested-object",
        fields: {
          columns: {
            component: "slider",
            min: 1,
            max: 20
          }
        }
      },
      tint: {
        component: "color"
      }
    };

    it(
      "walks nested-object fields for dotted paths",
      () => {
        expect( formConfigAt(
          formConfiguration,
          "grid.columns"
        ) ).toMatchObject( {
          component: "slider"
        } );
        expect( formConfigAt(
          formConfiguration,
          "grid.rows"
        ) ).toBeUndefined();
      }
    );

    it(
      "classifies by shape, upgraded by the form config",
      () => {
        expect( classifyLeaf( 3 ) ).toBe( "numbers" );
        expect( classifyLeaf( true ) ).toBe( "booleans" );
        expect( classifyLeaf( "morph" ) ).toBe( "strings" );
        expect( classifyLeaf( [
          1,
          2
        ] ) ).toBe( "vectors" );
        expect( classifyLeaf( [
          255,
          0,
          0
        ] ) ).toBe( "colors" );
        expect( classifyLeaf(
          [
            0,
            0,
            0
          ],
          {
            component: "color"
          }
        ) ).toBe( "colors" );
      }
    );
  }
);

describe(
  "differs",
  () => {
    it(
      "compares numbers with a relative epsilon",
      () => {
        expect( differs(
          1,
          1 + 1e-9
        ) ).toBe( false );
        expect( differs(
          1,
          2
        ) ).toBe( true );
      }
    );

    it(
      "compares arrays per component and flags length mismatches",
      () => {
        expect( differs(
          [
            255,
            0,
            0
          ],
          [
            255,
            0,
            0
          ]
        ) ).toBe( false );
        expect( differs(
          [
            255,
            0,
            0
          ],
          [
            255,
            0,
            1
          ]
        ) ).toBe( true );
        expect( differs(
          [
            255,
            0,
            0
          ],
          [
            255,
            0
          ]
        ) ).toBe( true );
      }
    );

    it(
      "treats a missing stock value as changed",
      () => {
        expect( differs(
          5,
          undefined
        ) ).toBe( true );
      }
    );
  }
);

describe(
  "deriveBreakdownSteps — grouping",
  () => {
    it(
      "isolated top-level leaves each become their OWN step; nested objects one step each",
      () => {
        const steps = deriveBreakdownSteps(
          sketch,
          {
            selection: "all"
          }
        );

        expect( steps.map( ( s: any ) => s.label ) ).toEqual( [
          "SEED",
          "ANIMATED",
          "STROKE COLOR",
          "GRID",
          "NOISE"
        ] );
        expect( steps[ 3 ].paths ).toEqual( [
          "grid.columns",
          "grid.offset"
        ] );
        expect( steps[ 3 ].leaves[ 0 ] ).toMatchObject( {
          path: "grid.columns",
          cls: "numbers"
        } );
      }
    );

    it(
      "skips reserved runtime keys and non-animatable leaves",
      () => {
        const steps = deriveBreakdownSteps(
          {
            bindings: {
              magnitude: "mic"
            },
            interaction: {
              mode: "orbit"
            },
            callback: () => 1,
            empty: null,
            mixed: [
              1,
              "two"
            ],
            scale: 2
          },
          {
            selection: "all"
          }
        );

        expect( steps.map( ( s: any ) => s.id ) ).toEqual( [
          "scale"
        ] );
      }
    );

    it(
      "excludeKeys removes leaves (dotted or bare) from every step",
      () => {
        const steps = deriveBreakdownSteps(
          sketch,
          {
            selection: "all",
            excludeKeys: [
              "seed",
              "grid.offset"
            ]
          }
        );

        const allPaths = steps.flatMap( ( s: any ) => s.paths );

        expect( allPaths ).not.toContain( "seed" );
        expect( allPaths ).not.toContain( "grid.offset" );
        expect( allPaths ).toContain( "grid.columns" );
      }
    );
  }
);

describe(
  "deriveBreakdownSteps — diff selection",
  () => {
    const formMeta = {
      formValues: {
        seed: 42, // unchanged
        animated: false, // changed
        strokeColor: [
          255,
          0,
          0
        ], // unchanged
        grid: {
          columns: 8, // unchanged
          offset: [
            0.5,
            0.5
          ] // changed (second component)
        },
        noise: {
          scale: 0.25,
          octaves: 3
        } // unchanged group
      }
    };

    it(
      "keeps only changed leaves; a partially-changed group narrates only those",
      () => {
        const steps = deriveBreakdownSteps(
          sketch,
          {
            selection: "changed"
          },
          formMeta
        );

        expect( steps.map( ( s: any ) => s.id ) ).toEqual( [
          "animated",
          "grid"
        ] );
        expect( steps[ 1 ].paths ).toEqual( [
          "grid.offset"
        ] );
      }
    );

    it(
      "a leaf missing from the stock defaults counts as changed",
      () => {
        const steps = deriveBreakdownSteps(
          {
            extra: 10
          },
          {
            selection: "changed"
          },
          {
            formValues: {
              other: 1
            }
          }
        );

        expect( steps.map( ( s: any ) => s.id ) ).toEqual( [
          "extra"
        ] );
      }
    );

    it(
      "without reachable formValues, 'changed' behaves as 'all'",
      () => {
        const all = deriveBreakdownSteps(
          sketch,
          {
            selection: "all"
          }
        );
        const noMeta = deriveBreakdownSteps(
          sketch,
          {
            selection: "changed"
          },
          {}
        );

        expect( noMeta.map( ( s: any ) => s.id ) ).toEqual( all.map( ( s: any ) => s.id ) );
      }
    );

    it(
      "returns [] when nothing changed",
      () => {
        const steps = deriveBreakdownSteps(
          {
            seed: 42
          },
          {
            selection: "changed"
          },
          {
            formValues: {
              seed: 42
            }
          }
        );

        expect( steps ).toEqual( [] );
      }
    );
  }
);

describe(
  "deriveBreakdownSteps — overflow",
  () => {
    it(
      "flags steps past MAX_ANIM_STEPS as overflow",
      () => {
        const wide: Record<string, number> = {};

        for ( let i = 0; i < MAX_ANIM_STEPS + 5; i++ ) {
          wide[ `p${ String( i ).padStart(
            2,
            "0"
          ) }` ] = i;
        }

        const steps = deriveBreakdownSteps(
          wide,
          {
            selection: "all"
          }
        );

        expect( steps ).toHaveLength( MAX_ANIM_STEPS + 5 );
        expect( steps.filter( ( s: any ) => s.overflow ) ).toHaveLength( 5 );
        expect( steps[ MAX_ANIM_STEPS - 1 ].overflow ).toBe( false );
        expect( steps[ MAX_ANIM_STEPS ].overflow ).toBe( true );
      }
    );
  }
);
