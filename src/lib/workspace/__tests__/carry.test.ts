import {
  applyCarried, collectCarried, mergePublications, PENDING_POSTIZ_KEY, pendingPostiz, readCarried
} from "../carry";
import type {
  Publication
} from "@/lib/postiz/publishStore";

/** A Storage over a Map, enough for these specs. */
function memoryStorage( initial: Record<string, unknown> = {} ): Storage {
  const map = new Map<string, string>( Object.entries( initial ).map( ( [
    k,
    v
  ] ) => [
    k,
    typeof v === "string" ? v : JSON.stringify( v )
  ] ) );

  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: ( key: string ) => map.get( key ) ?? null,
    key: ( index: number ) => [
      ...map.keys()
    ][ index ] ?? null,
    removeItem: ( key: string ) => {
      map.delete( key );
    },
    setItem: (
      key: string, value: string
    ) => {
      map.set(
        key,
        value
      );
    }
  };
}

const CONNECTION = {
  apiBase: "https://postiz.example/api/public/v1",
  apiKey: "secret-key",
  channels: [
    {
      id: "ig",
      name: "Instagram",
      identifier: "instagram",
      picture: "",
      disabled: false
    }
  ],
  defaultChannelIds: [
    "ig"
  ],
  collaborator: "",
  handles: {
    ig: "steeve"
  },
  usual: {
    ig: "video 9:16"
  },
  connectedAt: 1
};

function send(
  sentAt: number, postIds: string[]
): Publication {
  return {
    postIds,
    channelIds: [
      "ig"
    ],
    kind: "reel",
    variantName: "Reel",
    files: 1,
    at: null,
    target: "schedule",
    sentAt
  };
}

describe(
  "carried settings",
  () => {
    it(
      "collects the carried keys and never the Postiz key",
      () => {
        const carried = collectCarried( memoryStorage( {
          "sketchbook.postiz.v1": CONNECTION,
          "sketchbook.plan.v1": {
            mix: "balanced"
          },
          "sketchbook.publish.v1:p5/a": {
            draft: {},
            publications: []
          },
          "sketchbook:panel-state": {
            open: true
          },
          "sketchbook.plan.run.v1": {
            phase: "rendering"
          }
        } ) );

        expect( Object.keys( carried ).sort() ).toEqual( [
          "sketchbook.plan.v1",
          "sketchbook.postiz.v1",
          "sketchbook.publish.v1:p5/a"
        ] );
        expect( JSON.stringify( carried ) ).not.toContain( "secret-key" );
        expect( carried[ "sketchbook.postiz.v1" ] ).toMatchObject( {
          apiBase: CONNECTION.apiBase,
          handles: {
            ig: "steeve"
          }
        } );
      }
    );

    it(
      "ignores keys an archive should not carry",
      () => {
        expect( readCarried( {
          "sketchbook:panel-state": 1,
          "sketchbook.plan.run.v1": 2,
          "sketchbook.stats.v1": 3
        } ) ).toEqual( {
          "sketchbook.stats.v1": 3
        } );
      }
    );

    it(
      "keeps the Postiz settings waiting when this browser has no connection",
      () => {
        const storage = memoryStorage();
        const outcome = applyCarried(
          storage,
          {
            "sketchbook.postiz.v1": collectCarried( memoryStorage( {
              "sketchbook.postiz.v1": CONNECTION
            } ) )[ "sketchbook.postiz.v1" ]
          }
        );

        expect( outcome.postizPending ).toBe( true );
        expect( storage.getItem( "sketchbook.postiz.v1" ) ).toBeNull();
        expect( storage.getItem( PENDING_POSTIZ_KEY ) ).not.toContain( "secret" );
        expect( pendingPostiz( storage )?.handles ).toEqual( {
          ig: "steeve"
        } );
      }
    );

    it(
      "adds only the handles and formats a kept connection lacks",
      () => {
        const storage = memoryStorage( {
          "sketchbook.postiz.v1": {
            ...CONNECTION,
            handles: {},
            usual: {
              ig: "picture 4:5"
            }
          }
        } );

        applyCarried(
          storage,
          {
            "sketchbook.postiz.v1": {
              ...CONNECTION,
              apiKey: undefined
            }
          }
        );

        const kept = JSON.parse( storage.getItem( "sketchbook.postiz.v1" ) ?? "{}" );

        expect( kept.apiKey ).toBe( "secret-key" );
        expect( kept.handles ).toEqual( {
          ig: "steeve"
        } );
        expect( kept.usual ).toEqual( {
          ig: "picture 4:5"
        } );
      }
    );

    it(
      "adds the sends this browser lacks, once each, oldest first",
      () => {
        expect( mergePublications(
          [
            send(
              2,
              [
                "b"
              ]
            )
          ],
          [
            send(
              1,
              [
                "a"
              ]
            ),
            send(
              2,
              [
                "b"
              ]
            )
          ]
        ).map( ( p ) => p.postIds[ 0 ] ) ).toEqual( [
          "a",
          "b"
        ] );
      }
    );

    it(
      "takes a store this browser lacks and keeps one it has",
      () => {
        const storage = memoryStorage( {
          "sketchbook.export.variants.v2:p5/a": [
            {
              id: "mine"
            }
          ]
        } );
        const outcome = applyCarried(
          storage,
          {
            "sketchbook.export.variants.v2:p5/a": [
              {
                id: "theirs"
              }
            ],
            "sketchbook.export.variants.v2:p5/b": [
              {
                id: "theirs"
              }
            ],
            "sketchbook.stats.level.v1": "show"
          }
        );

        expect( outcome.written.sort() ).toEqual( [
          "sketchbook.export.variants.v2:p5/b",
          "sketchbook.stats.level.v1"
        ] );
        expect( storage.getItem( "sketchbook.export.variants.v2:p5/a" ) ).toContain( "mine" );
      }
    );

    it(
      "merges post readings by post, this browser's first",
      () => {
        const storage = memoryStorage( {
          "sketchbook.stats.v1": {
            posts: {
              p1: {
                publishedAt: 1,
                askedAt: 5
              }
            },
            unsupported: null
          }
        } );

        applyCarried(
          storage,
          {
            "sketchbook.stats.v1": {
              posts: {
                p1: {
                  publishedAt: 1,
                  askedAt: 9
                },
                p2: {
                  publishedAt: 2,
                  askedAt: 3
                }
              },
              unsupported: null
            }
          }
        );

        const posts = JSON.parse( storage.getItem( "sketchbook.stats.v1" ) ?? "{}" ).posts;

        expect( Object.keys( posts ).sort() ).toEqual( [
          "p1",
          "p2"
        ] );
        expect( posts.p1.askedAt ).toBe( 5 );
      }
    );
  }
);
