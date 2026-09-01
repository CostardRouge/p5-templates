import migrateInteractiveOptions from "@/utils/migrateInteractiveOptions";
import initOptions from "@/utils/initOptions";

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
