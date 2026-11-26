import {
  mergeSettings, planGallery
} from "../plan";

describe(
  "planGallery",
  () => {
    const plan = (
      here: Record<string, string>, there: Record<string, [ string, string | null ]>, known: Record<string, [ string, string ]> = {}
    ) => planGallery(
      new Map( Object.entries( here ) ),
      new Map( Object.entries( there ).map( ( [
        id,
        [
          etag,
          hash
        ]
      ] ) => [
        id,
        {
          etag,
          hash
        }
      ] ) ),
      Object.fromEntries( Object.entries( known ).map( ( [
        id,
        [
          etag,
          hash
        ]
      ] ) => [
        id,
        {
          etag,
          hash
        }
      ] ) )
    );

    it(
      "pushes what is new here and pulls what is new there",
      () => {
        const p = plan(
          {
            a: "ha"
          },
          {
            b: [
              "e1",
              "hb"
            ]
          }
        );

        expect( p.push ).toEqual( [
          "a"
        ] );
        expect( p.pull ).toEqual( [
          "b"
        ] );
      }
    );

    it(
      "tells a piece deleted here from one added there by what the last sync knew",
      () => {
        const p = plan(
          {
            kept: "h1"
          },
          {
            gone: [
              "e1",
              "h2"
            ]
          },
          {
            kept: [
              "e0",
              "h1"
            ],
            gone: [
              "e1",
              "h2"
            ]
          }
        );

        expect( p.deleteHere ).toEqual( [
          "kept"
        ] );
        expect( p.deleteThere ).toEqual( [
          "gone"
        ] );
        expect( p.push ).toEqual( [] );
        expect( p.pull ).toEqual( [] );
      }
    );

    it(
      "sends a rename made here, takes one made there, and lets the store win when both changed",
      () => {
        const p = plan(
          {
            mine: "new",
            theirs: "h",
            both: "new"
          },
          {
            mine: [
              "e",
              "h"
            ],
            theirs: [
              "e2",
              "h2"
            ],
            both: [
              "e2",
              "h2"
            ]
          },
          {
            mine: [
              "e",
              "h"
            ],
            theirs: [
              "e",
              "h"
            ],
            both: [
              "e",
              "h"
            ]
          }
        );

        expect( p.update ).toEqual( [
          "mine"
        ] );
        expect( p.pull.sort() ).toEqual( [
          "both",
          "theirs"
        ] );
      }
    );

    it(
      "downloads nothing for a piece both sides already hold under the same id",
      () => {
        const p = plan(
          {
            a: "h"
          },
          {
            a: [
              "e",
              "h"
            ]
          }
        );

        expect( p.same ).toEqual( [
          "a"
        ] );
        expect( p.pull ).toEqual( [] );
      }
    );
  }
);

describe(
  "mergeSettings",
  () => {
    const NOW = Date.parse( "2026-11-26T12:00:00Z" );

    it(
      "takes the store's whole value when it did not change here, and keeps this browser's when it did",
      () => {
        const base = {
          "sketchbook.stats.level.v1": "off",
          "sketchbook.export.variants.v2:p5/a": [
            {
              id: "old"
            }
          ]
        };
        const here = {
          "sketchbook.stats.level.v1": "off",
          "sketchbook.export.variants.v2:p5/a": [
            {
              id: "mine"
            }
          ]
        };
        const there = {
          "sketchbook.stats.level.v1": "show",
          "sketchbook.export.variants.v2:p5/a": [
            {
              id: "theirs"
            }
          ]
        };
        const merged = mergeSettings(
          base,
          here,
          there,
          NOW
        );

        expect( merged[ "sketchbook.stats.level.v1" ] ).toBe( "show" );
        expect( merged[ "sketchbook.export.variants.v2:p5/a" ] ).toEqual( [
          {
            id: "mine"
          }
        ] );
      }
    );

    it(
      "joins the sends of both sides",
      () => {
        const send = (
          sentAt: number, id: string
        ) => ( {
          postIds: [
            id
          ],
          channelIds: [
            "ig"
          ],
          kind: "reel",
          variantName: "Reel",
          files: 1,
          at: null,
          target: "schedule",
          sentAt
        } );
        const merged = mergeSettings(
          {},
          {
            "sketchbook.publish.v1:p5/a": {
              draft: {},
              publications: [
                send(
                  1,
                  "a"
                )
              ]
            }
          },
          {
            "sketchbook.publish.v1:p5/a": {
              draft: {},
              publications: [
                send(
                  2,
                  "b"
                )
              ]
            }
          },
          NOW
        );
        const publications = ( merged[ "sketchbook.publish.v1:p5/a" ] as { publications: { postIds: string[] }[] } ).publications;

        expect( publications.map( ( p ) => p.postIds[ 0 ] ) ).toEqual( [
          "a",
          "b"
        ] );
      }
    );

    it(
      "takes a store this browser lacks, and keeps one the store lacks",
      () => {
        const merged = mergeSettings(
          {},
          {
            "sketchbook.stats.level.v1": "show"
          },
          {
            "sketchbook.export.variants.v2:p5/b": [
              {
                id: "x"
              }
            ]
          },
          NOW
        );

        expect( Object.keys( merged ).sort() ).toEqual( [
          "sketchbook.export.variants.v2:p5/b",
          "sketchbook.stats.level.v1"
        ] );
      }
    );
  }
);
