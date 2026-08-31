import migrateLegacyHudItems from "@/utils/migrateLegacyHudItems";
import initOptions from "@/utils/initOptions";

type AnyRecord = Record<string, any>;

describe(
  "migrateLegacyHudItems",
  () => {
    it(
      "expands a pristine legacy hud into exactly its enabled slots, in place",
      () => {
        const options = {
          content: [
            {
              type: "text",
              content: "before"
            },
            {
              type: "hud"
            },
            {
              type: "qrcode"
            }
          ]
        };

        const migrated = migrateLegacyHudItems( options ) as AnyRecord;
        const types = migrated.content.map( ( item: AnyRecord ) => item.type );

        // Only gauge + sparkline defaulted to enabled inside the container —
        // visual parity with what the legacy item actually rendered. Order
        // follows the old draw order (sparkline under gauge), at the hud
        // item's position between its neighbours.
        expect( types ).toEqual( [
          "text",
          "hud-sparkline",
          "hud-gauge",
          "qrcode"
        ] );
      }
    );

    it(
      "keeps a disabled-but-customised slot as a disabled element",
      () => {
        const migrated = migrateLegacyHudItems( {
          content: [
            {
              type: "hud",
              badge: {
                enabled: false,
                override: "customised"
              },
              gauge: {
                enabled: false
              },
              sparkline: {
                enabled: false
              }
            }
          ]
        } ) as AnyRecord;

        // The untouched-disabled gauge/sparkline slots are dropped; the
        // customised badge survives, still disabled (the layers list's eye
        // can re-enable it).
        expect( migrated.content ).toHaveLength( 1 );
        expect( migrated.content[ 0 ].type ).toBe( "hud-badge" );
        expect( migrated.content[ 0 ].enabled ).toBe( false );
        expect( migrated.content[ 0 ].override ).toBe( "customised" );
      }
    );

    it(
      "flows the container style into expanded elements, slot values winning",
      () => {
        const migrated = migrateLegacyHudItems( {
          content: [
            {
              type: "hud",
              fill: [
                255,
                0,
                0,
                255
              ],
              backgroundColor: [
                10,
                10,
                10,
                200
              ],
              gauge: {
                enabled: true
              },
              sparkline: {
                enabled: true,
                fill: [
                  0,
                  0,
                  255,
                  255
                ]
              }
            }
          ]
        } ) as AnyRecord;

        const gauge = migrated.content.find( ( item: AnyRecord ) => item.type === "hud-gauge" );
        const sparkline = migrated.content.find( ( item: AnyRecord ) => item.type === "hud-sparkline" );

        expect( gauge.fill ).toEqual( [
          255,
          0,
          0,
          255
        ] );
        expect( gauge.backgroundColor ).toEqual( [
          10,
          10,
          10,
          200
        ] );
        expect( sparkline.fill ).toEqual( [
          0,
          0,
          255,
          255
        ] );
        expect( sparkline.backgroundColor ).toEqual( [
          10,
          10,
          10,
          200
        ] );
      }
    );

    it(
      "expands hud items inside slide content too",
      () => {
        const migrated = migrateLegacyHudItems( {
          slides: [
            {
              content: [
                {
                  type: "hud",
                  counter: {
                    enabled: true,
                    offset: {
                      x: 0.3,
                      y: 0.3
                    }
                  },
                  gauge: {
                    enabled: false
                  },
                  sparkline: {
                    enabled: false
                  }
                }
              ]
            }
          ]
        } ) as AnyRecord;

        expect( migrated.slides[ 0 ].content ).toHaveLength( 1 );
        expect( migrated.slides[ 0 ].content[ 0 ].type ).toBe( "hud-counter" );
        expect( migrated.slides[ 0 ].content[ 0 ].offset ).toEqual( {
          x: 0.3,
          y: 0.3
        } );
      }
    );

    it(
      "does not mutate its input and returns it untouched when hud-free",
      () => {
        const legacy = {
          content: [
            {
              type: "hud"
            }
          ]
        };
        const snapshot = JSON.parse( JSON.stringify( legacy ) );

        migrateLegacyHudItems( legacy );
        expect( legacy ).toEqual( snapshot );

        const clean = {
          content: [
            {
              type: "text",
              content: "hi"
            }
          ],
          slides: [
            {
              content: []
            }
          ]
        };

        // Identity return — nothing was copied for nothing.
        expect( migrateLegacyHudItems( clean ) ).toBe( clean );
      }
    );

    it(
      "is idempotent",
      () => {
        const once = migrateLegacyHudItems( {
          content: [
            {
              type: "hud"
            }
          ]
        } );

        expect( migrateLegacyHudItems( once ) ).toBe( once );
      }
    );

    it(
      "drops a malformed slot instead of failing the expansion",
      () => {
        const migrated = migrateLegacyHudItems( {
          content: [
            {
              type: "hud",
              gauge: {
                enabled: true
              },
              sparkline: "not an object",
              counter: {
                enabled: "also broken"
              }
            }
          ]
        } ) as AnyRecord;

        const types = migrated.content.map( ( item: AnyRecord ) => item.type );

        expect( types ).toEqual( [
          "hud-gauge"
        ] );
      }
    );

    it(
      "keeps a legacy hud tree alive through initOptions' top-level catch",
      () => {
        // Without the pre-parse migration, an unknown `type: "hud"` fails the
        // strictly-parsed content union and the top-level `.catch` resets the
        // WHOLE options to defaults — siblings included. This locks in that
        // the legacy shape survives instead.
        const parsed = initOptions( {
          animation: {
            duration: 7
          },
          content: [
            {
              type: "text",
              content: "kept"
            },
            {
              type: "hud",
              counter: {
                enabled: true
              },
              gauge: {
                enabled: false
              },
              sparkline: {
                enabled: false
              }
            }
          ]
        } ) as AnyRecord;

        expect( parsed.animation.duration ).toBe( 7 );
        expect( parsed.content.map( ( item: AnyRecord ) => item.type ) ).toEqual( [
          "text",
          "hud-counter"
        ] );
      }
    );
  }
);
