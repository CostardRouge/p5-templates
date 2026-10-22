import migrateInteractiveOptions, {
  effectiveSlideInteractive
} from "@/utils/migrateInteractiveOptions";
import initOptions from "@/utils/initOptions";

const rootBinding = {
  id: "root-1",
  source: "oscillator",
  target: "grid.rows",
  kind: "continuous"
};

describe(
  "effectiveSlideInteractive",
  () => {
    it(
      "reads each key from the slide, falling back to the root — as the engine does",
      () => {
        const slideBindings = [
          {
            id: "slide-1",
            source: "ramp",
            target: "grid.columns",
            kind: "continuous"
          }
        ];
        const merged = effectiveSlideInteractive(
          {
            bindings: [
              rootBinding
            ],
            interaction: {
              midi: {
                enabled: true
              }
            }
          },
          {
            bindings: slideBindings
          }
        ) as Record<string, any>;

        expect( merged.bindings ).toEqual( slideBindings );
        expect( merged.interaction.midi.enabled ).toBe( true );
      }
    );

    it(
      "lets the root show through a slide key that is explicitly undefined",
      () => {
        // A spread would let `interaction: undefined` (what the pruning writes)
        // hide the root's block — which the engine reads anyway.
        const merged = effectiveSlideInteractive(
          {
            interaction: {
              enabled: true
            }
          },
          {
            bindings: [],
            interaction: undefined
          }
        ) as Record<string, any>;

        expect( merged.interaction ).toEqual( {
          enabled: true
        } );
        expect( merged.bindings ).toEqual( [] );
      }
    );

    it(
      "deep-clones, so editing the slide's copy cannot reach the root",
      () => {
        const root = {
          bindings: [
            {
              ...rootBinding,
              mapping: {
                min: 1,
                max: 9
              }
            }
          ]
        };
        const merged = effectiveSlideInteractive(
          root,
          undefined
        ) as Record<string, any>;

        merged.bindings[ 0 ].mapping.min = 5;

        expect( root.bindings[ 0 ].mapping.min ).toBe( 1 );
      }
    );

    it(
      "is undefined when neither side carries anything",
      () => {
        expect( effectiveSlideInteractive(
          undefined,
          undefined
        ) ).toBeUndefined();
        expect( effectiveSlideInteractive(
          {},
          {
            bindings: undefined
          }
        ) ).toBeUndefined();
      }
    );
  }
);

describe(
  "migrateInteractiveOptions",
  () => {
    it(
      "moves legacy sketch.bindings to interactive.bindings",
      () => {
        const bindings = [
          {
            source: "mouse",
            target: "radius",
            kind: "continuous"
          }
        ];
        const options: Record<string, any> = migrateInteractiveOptions( {
          sketch: {
            radius: 10,
            bindings
          }
        } );

        expect( options.interactive.bindings ).toBe( bindings );
        expect( options.sketch.bindings ).toBeUndefined();
        expect( options.sketch.radius ).toBe( 10 );
      }
    );

    it(
      "does NOT mutate the input — the parsed tree shares `sketch` by reference with page props / the live store",
      () => {
        const input = {
          sketch: {
            radius: 10,
            bindings: [
              {
                source: "mouse",
                target: "radius",
                kind: "continuous"
              }
            ]
          },
          slides: [
            {
              sketch: {
                bindings: [
                  {
                    source: "orbit",
                    target: "spin",
                    kind: "continuous"
                  }
                ]
              }
            }
          ]
        };
        const migrated: Record<string, any> = migrateInteractiveOptions( input );

        // The input keeps its legacy shape untouched…
        expect( input.sketch.bindings ).toHaveLength( 1 );
        expect( input.slides[ 0 ].sketch.bindings ).toHaveLength( 1 );
        expect( ( input as Record<string, any> ).interactive ).toBeUndefined();

        // …and a second migration of the same input still finds the bindings
        // (the original in-place version stripped them on first call, so
        // re-parses of shared props produced no `interactive` namespace).
        const again: Record<string, any> = migrateInteractiveOptions( input );

        expect( migrated.interactive.bindings ).toHaveLength( 1 );
        expect( again.interactive.bindings ).toHaveLength( 1 );
        expect( again.slides[ 0 ].interactive.bindings ).toHaveLength( 1 );
      }
    );

    it(
      "keeps an existing interactive.bindings over a legacy copy, dropping the legacy one",
      () => {
        const kept = [
          {
            source: "orbit",
            target: "count",
            kind: "continuous"
          }
        ];
        const options: Record<string, any> = migrateInteractiveOptions( {
          sketch: {
            bindings: [
              {
                source: "mouse",
                target: "count",
                kind: "continuous"
              }
            ]
          },
          interactive: {
            bindings: kept
          }
        } );

        expect( options.interactive.bindings ).toBe( kept );
        expect( options.sketch.bindings ).toBeUndefined();
      }
    );

    it(
      "leaves sketch.interaction where it is (sketch-declared blocks are real parameters)",
      () => {
        const interaction = {
          enabled: true,
          vision: {
            enabled: true
          }
        };
        const options: Record<string, any> = migrateInteractiveOptions( {
          sketch: {
            interaction
          }
        } );

        expect( options.sketch.interaction ).toBe( interaction );
        expect( options.interactive ).toBeUndefined();
      }
    );

    it(
      "migrates per-slide sketch.bindings to the slide's interactive namespace",
      () => {
        const slideBindings = [
          {
            source: "mouse",
            target: "spin",
            kind: "continuous"
          }
        ];
        const options: Record<string, any> = migrateInteractiveOptions( {
          sketch: {},
          slides: [
            {
              sketch: {
                spin: 1,
                bindings: slideBindings
              }
            },
            {
              sketch: {
                spin: 2
              }
            }
          ]
        } );

        expect( options.slides[ 0 ].interactive.bindings ).toBe( slideBindings );
        expect( options.slides[ 0 ].sketch.bindings ).toBeUndefined();
        expect( options.slides[ 1 ].interactive ).toBeUndefined();
      }
    );

    it(
      "gives a slide the root bindings the engine was already playing on it",
      () => {
        const ownBindings = [
          {
            id: "own",
            source: "ramp",
            target: "spin",
            kind: "continuous"
          }
        ];
        const input = {
          sketch: {},
          interactive: {
            bindings: [
              rootBinding
            ]
          },
          slides: [
            {
              sketch: {}
            },
            {
              sketch: {},
              interactive: {
                bindings: ownBindings
              }
            },
            {
              sketch: {},
              interactive: {
                bindings: []
              }
            }
          ]
        };
        const options: Record<string, any> = migrateInteractiveOptions( input );

        // Inherited: now visible to the editor, and a copy rather than the
        // root's own objects.
        expect( options.slides[ 0 ].interactive.bindings ).toEqual( [
          rootBinding
        ] );
        expect( options.slides[ 0 ].interactive.bindings[ 0 ] ).not.toBe( rootBinding );
        // A slide with its own list — even an empty one — overrides the root
        // at runtime, and keeps doing so.
        expect( options.slides[ 1 ] ).toBe( input.slides[ 1 ] );
        expect( options.slides[ 2 ].interactive.bindings ).toEqual( [] );
        // The input itself is left alone.
        expect( ( input.slides[ 0 ] as Record<string, any> ).interactive ).toBeUndefined();
      }
    );

    it(
      "returns the input object unchanged when nothing needs migrating",
      () => {
        const input = {
          sketch: {
            radius: 4
          }
        };
        const options: Record<string, any> = migrateInteractiveOptions( input );

        expect( options ).toBe( input );
        expect( options.interactive ).toBeUndefined();
      }
    );
  }
);

describe(
  "initOptions (interactive migration wired in)",
  () => {
    it(
      "parses legacy options and relocates bindings, preserving interactive through the schema",
      () => {
        const parsed = initOptions( {
          sketch: {
            radius: 12,
            bindings: [
              {
                source: "oscillator",
                target: "radius",
                kind: "continuous"
              }
            ]
          }
        } ) as Record<string, any>;

        expect( parsed.interactive.bindings ).toHaveLength( 1 );
        expect( parsed.sketch.bindings ).toBeUndefined();
      }
    );

    it(
      "leaves the caller's options object intact across repeated initOptions calls",
      () => {
        const raw = {
          sketch: {
            radius: 12,
            bindings: [
              {
                source: "mouse",
                target: "radius",
                kind: "continuous"
              }
            ]
          }
        };

        const first = initOptions( raw ) as Record<string, any>;
        const second = initOptions( raw ) as Record<string, any>;

        expect( raw.sketch.bindings ).toHaveLength( 1 );
        expect( first.interactive.bindings ).toHaveLength( 1 );
        expect( second.interactive.bindings ).toHaveLength( 1 );
      }
    );

    it(
      "loads a saved deck whose slides ran the root bindings with those bindings on each slide",
      () => {
        const parsed = initOptions( {
          interactive: {
            bindings: [
              rootBinding
            ]
          },
          slides: [
            {
              name: "A",
              sketch: {}
            },
            {
              name: "A-1",
              sketch: {}
            }
          ]
        } ) as Record<string, any>;

        expect( parsed.slides[ 0 ].interactive.bindings ).toEqual( [
          rootBinding
        ] );
        expect( parsed.slides[ 1 ].interactive.bindings ).toEqual( [
          rootBinding
        ] );
        // Two copies, not one shared array: editing A must not edit A-1.
        expect( parsed.slides[ 0 ].interactive.bindings ).not.toBe( parsed.slides[ 1 ].interactive.bindings );
      }
    );

    it(
      "keeps an already-migrated interactive namespace intact through parse",
      () => {
        const parsed = initOptions( {
          interactive: {
            bindings: [
              {
                source: "mouse",
                target: "spin",
                kind: "continuous"
              }
            ],
            interaction: {
              enabled: true,
              mouse: {
                enabled: true
              }
            }
          }
        } ) as Record<string, any>;

        expect( parsed.interactive.bindings ).toHaveLength( 1 );
        expect( parsed.interactive.interaction.mouse.enabled ).toBe( true );
      }
    );
  }
);
