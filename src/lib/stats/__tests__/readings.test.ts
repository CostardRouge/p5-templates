import type {
  PostAnalytics
} from "../../postiz/analytics";
import {
  PostizError
} from "../../postiz/client";
import {
  figure, figuresOf, formatCount, formatTimes, headline, headlineWord, keepRate, median
} from "../metrics";
import {
  NO_ROUTE, readPosts
} from "../reader";
import {
  dueOnLook, dueReadings, dueReason, GIVE_UP_DAYS, RETRY_MS, RUN_BUDGET, type Candidate
} from "../schedule";
import {
  clearStatsLevel, getStatsLevel, readLevel, setStatsLevel, statsListened, statsShown
} from "../settings";
import {
  clearStats, DAY_MS, EMPTY_STATS, getStats, keepAnswer, markUnsupported, pruned, readStats, withAnswer, type StatsState
} from "../store";

const NOW = Date.parse( "2026-11-20T12:00:00Z" );
const BASE = "https://postiz.example/api/public/v1";

const answer = ( figures: Record<string, number> ): PostAnalytics => ( {
  kind: "figures",
  series: Object.entries( figures ).map( ( [
    label,
    value
  ] ) => ( {
    label,
    points: [
      {
        total: value,
        date: "2026-11-20"
      }
    ]
  } ) )
} );

const post = (
  postId: string, days: number, provider: Candidate[ "provider" ] = "instagram"
): Candidate => ( {
  postId,
  provider,
  publishedAt: NOW - days * DAY_MS
} );

describe(
  "a post's figures",
  () => {
    it(
      "keeps each network's label and files it under a common key",
      () => {
        const x = figuresOf( ( answer( {
          Impressions: 1180,
          Likes: 96,
          Retweets: 7,
          Replies: 4,
          Quotes: 1,
          Bookmarks: 22
        } ) as Extract<PostAnalytics, { kind: "figures" }> ).series );

        expect( x.map( ( f ) => `${ f.label }:${ f.key }` ) ).toEqual( [
          "Impressions:views",
          "Likes:likes",
          "Retweets:shares",
          "Replies:comments",
          "Quotes:quotes",
          "Bookmarks:saves"
        ] );
        // The headline is the network's own word, and the rate its own labels.
        expect( headlineWord( headline( x )! ) ).toBe( "impressions" );
        expect( keepRate( x )!.words ).toBe( "bookmarks + retweets per 100 impressions" );
        expect( keepRate( x )!.value ).toBeCloseTo(
          100 * 29 / 1180,
          6
        );
      }
    );

    it(
      "reads Instagram by its reach, and invents nothing a network does not give",
      () => {
        const instagram = figuresOf( ( answer( {
          Views: 5120,
          Reach: 4210,
          Saves: 96,
          Likes: 312,
          Comments: 18,
          Shares: 41
        } ) as Extract<PostAnalytics, { kind: "figures" }> ).series );
        const tiktok = figuresOf( ( answer( {
          Views: 900,
          Likes: 40,
          Comments: 2,
          Shares: 3
        } ) as Extract<PostAnalytics, { kind: "figures" }> ).series );

        expect( headline( instagram ) ).toMatchObject( {
          label: "Reach",
          value: 4210
        } );
        expect( headlineWord( headline( instagram )! ) ).toBe( "reached" );
        // TikTok gives no save: no rate, and no zero in its place.
        expect( figure(
          tiktok,
          "saves"
        ) ).toBeNull();
        expect( keepRate( tiktok ) ).toBeNull();
        expect( headline( figuresOf( ( answer( {
          Likes: 3
        } ) as Extract<PostAnalytics, { kind: "figures" }> ).series ) ) ).toBeNull();
        // A label nobody knows is kept for the eye, under no key.
        expect( figuresOf( [
          {
            label: "Sticker Taps",
            points: [
              {
                total: 2,
                date: ""
              }
            ]
          }
        ] ) ).toEqual( [
          {
            label: "Sticker Taps",
            key: null,
            value: 2
          }
        ] );
      }
    );

    it(
      "formats a count whole and a ratio short",
      () => {
        expect( formatCount( 4210 ) ).toBe( "4,210" );
        expect( formatTimes( 2.14 ) ).toBe( "2.1×" );
        expect( formatTimes( 0.04 ) ).toBe( "0.04×" );
        expect( median( [] ) ).toBeNull();
        expect( median( [
          3,
          1,
          2
        ] ) ).toBe( 2 );
        expect( median( [
          4,
          1,
          2,
          3
        ] ) ).toBe( 2.5 );
      }
    );
  }
);

describe(
  "the readings kept",
  () => {
    beforeEach( () => {
      clearStats();
      clearStatsLevel();
    } );

    it(
      "is off by default, and reads a level it does not know as off",
      () => {
        expect( getStatsLevel() ).toBe( "off" );
        expect( statsShown() ).toBe( false );
        expect( statsListened() ).toBe( false );
        expect( readLevel( "everything" ) ).toBe( "off" );
        expect( setStatsLevel( "show" ) ).toBe( "show" );
        expect( statsShown() ).toBe( true );
        expect( statsListened() ).toBe( false );
        expect( setStatsLevel( "listen" ) ).toBe( "listen" );
        expect( statsListened() ).toBe( true );
      }
    );

    it(
      "keeps the first reading of each age and never rewrites the settled one",
      () => {
        const publishedAt = NOW - 10 * DAY_MS;
        const day1 = withAnswer(
          undefined,
          publishedAt,
          answer( {
            Reach: 100
          } ),
          publishedAt + 1 * DAY_MS
        );

        expect( day1.last?.figures[ 0 ].value ).toBe( 100 );
        expect( day1.early ).toBeUndefined();
        expect( day1.settled ).toBeUndefined();

        const day3 = withAnswer(
          day1,
          publishedAt,
          answer( {
            Reach: 300
          } ),
          publishedAt + 3 * DAY_MS
        );
        const day5 = withAnswer(
          day3,
          publishedAt,
          answer( {
            Reach: 500
          } ),
          publishedAt + 5 * DAY_MS
        );

        expect( day5.early?.figures[ 0 ].value ).toBe( 300 );
        expect( day5.early?.ageDays ).toBe( 3 );
        expect( day5.last?.figures[ 0 ].value ).toBe( 500 );

        const day8 = withAnswer(
          day5,
          publishedAt,
          answer( {
            Reach: 800
          } ),
          publishedAt + 8 * DAY_MS
        );
        const day30 = withAnswer(
          day8,
          publishedAt,
          answer( {
            Reach: 3000
          } ),
          publishedAt + 30 * DAY_MS
        );

        expect( day30.settled?.figures[ 0 ].value ).toBe( 800 );
        expect( day30.settled?.ageDays ).toBe( 8 );
        expect( day30.last?.figures[ 0 ].value ).toBe( 3000 );
      }
    );

    it(
      "remembers an empty answer as asked, without a figure",
      () => {
        const none = withAnswer(
          undefined,
          NOW - 3 * DAY_MS,
          {
            kind: "none"
          },
          NOW
        );

        expect( none ).toEqual( {
          publishedAt: NOW - 3 * DAY_MS,
          askedAt: NOW,
          empty: "none"
        } );
        // Figures later take the empty mark away.
        expect( withAnswer(
          none,
          NOW - 3 * DAY_MS,
          answer( {
            Views: 5
          } ),
          NOW + 1
        ).empty ).toBeUndefined();
        expect( withAnswer(
          undefined,
          NOW,
          {
            kind: "missing"
          },
          NOW
        ).empty ).toBe( "missing" );
      }
    );

    it(
      "reads back only what is well formed, and drops the oldest beyond the cap",
      () => {
        expect( readStats( "nonsense" ) ).toEqual( EMPTY_STATS );
        expect( readStats( {
          posts: {
            ok: {
              publishedAt: 1,
              askedAt: 2,
              settled: {
                at: 2,
                ageDays: 8,
                figures: [
                  {
                    label: "Reach",
                    key: "reach",
                    value: 10
                  },
                  {
                    label: "Odd",
                    key: "nope",
                    value: 1
                  },
                  {
                    label: "Bad",
                    value: "12"
                  }
                ]
              },
              last: {
                at: 2
              }
            },
            bad: {
              publishedAt: "yesterday"
            }
          },
          unsupported: {
            base: BASE,
            at: 5
          }
        } ) ).toEqual( {
          posts: {
            ok: {
              publishedAt: 1,
              askedAt: 2,
              settled: {
                at: 2,
                ageDays: 8,
                figures: [
                  {
                    label: "Reach",
                    key: "reach",
                    value: 10
                  },
                  {
                    label: "Odd",
                    key: null,
                    value: 1
                  }
                ]
              }
            }
          },
          unsupported: {
            base: BASE,
            at: 5
          }
        } );

        const many: StatsState = {
          posts: Object.fromEntries( [
            1,
            2,
            3
          ].map( ( n ) => [
            `p${ n }`,
            {
              publishedAt: n,
              askedAt: n
            }
          ] ) ),
          unsupported: null
        };

        expect( Object.keys( pruned(
          many,
          2
        ).posts ).sort() ).toEqual( [
          "p2",
          "p3"
        ] );
        expect( pruned(
          many,
          3
        ) ).toBe( many );
      }
    );
  }
);

describe(
  "when a post is asked about",
  () => {
    it(
      "waits a day, then asks once per age, and never a network Postiz reads nothing from",
      () => {
        expect( dueReason(
          post(
            "a",
            0.5
          ),
          undefined,
          NOW
        ) ).toBeNull();
        expect( dueReason(
          post(
            "a",
            1.5
          ),
          undefined,
          NOW
        ) ).toBe( "first" );
        expect( dueReason(
          post(
            "a",
            3
          ),
          undefined,
          NOW
        ) ).toBe( "early" );
        expect( dueReason(
          post(
            "a",
            9
          ),
          undefined,
          NOW
        ) ).toBe( "settled" );
        expect( dueReason(
          post(
            "a",
            9,
            "bluesky"
          ),
          undefined,
          NOW
        ) ).toBeNull();

        const settled = withAnswer(
          undefined,
          NOW - 9 * DAY_MS,
          answer( {
            Reach: 1
          } ),
          NOW - DAY_MS
        );

        // Settled: never asked again by itself, however old the reading.
        expect( dueReason(
          post(
            "a",
            9
          ),
          settled,
          NOW
        ) ).toBeNull();
        expect( dueReason(
          post(
            "a",
            300
          ),
          settled,
          NOW + 290 * DAY_MS
        ) ).toBeNull();
      }
    );

    it(
      "leaves a post alone after asking, and gives up on one that never answers",
      () => {
        const asked = withAnswer(
          undefined,
          NOW - 9 * DAY_MS,
          {
            kind: "none"
          },
          NOW - RETRY_MS + 1000
        );

        expect( dueReason(
          post(
            "a",
            9
          ),
          asked,
          NOW
        ) ).toBeNull();
        expect( dueReason(
          post(
            "a",
            9
          ),
          asked,
          NOW + 2000
        ) ).toBe( "settled" );
        expect( dueReason(
          post(
            "a",
            GIVE_UP_DAYS + 1
          ),
          {
            ...asked,
            publishedAt: NOW - ( GIVE_UP_DAYS + 1 ) * DAY_MS,
            askedAt: 0
          },
          NOW
        ) ).toBeNull();
      }
    );

    it(
      "asks the settled readings first, each post once, within the budget",
      () => {
        const posts = [
          post(
            "first",
            1.2
          ),
          post(
            "early",
            4
          ),
          post(
            "settled-new",
            8
          ),
          post(
            "settled-old",
            20
          ),
          post(
            "settled-old",
            20
          ),
          post(
            "bsky",
            20,
            "bluesky"
          )
        ];

        expect( dueReadings(
          posts,
          EMPTY_STATS,
          NOW,
          BASE
        ).map( ( d ) => `${ d.postId }:${ d.reason }` ) ).toEqual( [
          "settled-old:settled",
          "settled-new:settled",
          "early:early",
          "first:first"
        ] );
        expect( dueReadings(
          posts,
          EMPTY_STATS,
          NOW,
          BASE,
          2
        ) ).toHaveLength( 2 );
        expect( dueReadings(
          Array.from(
            {
              length: 40
            },
            (
              _, i
            ) => post(
              `p${ i }`,
              10 + i
            )
          ),
          EMPTY_STATS,
          NOW,
          BASE
        ) ).toHaveLength( RUN_BUDGET );
        // A Postiz known to have no analytics route is not asked for a day.
        expect( dueReadings(
          posts,
          {
            posts: {},
            unsupported: {
              base: BASE,
              at: NOW - 1000
            }
          },
          NOW,
          BASE
        ) ).toEqual( [] );
        expect( dueReadings(
          posts,
          {
            posts: {},
            unsupported: {
              base: BASE,
              at: NOW - 2 * DAY_MS
            }
          },
          NOW,
          BASE
        ) ).toHaveLength( 4 );
      }
    );

    it(
      "reads again on a look only what has not settled, at most once an hour",
      () => {
        const fresh = withAnswer(
          undefined,
          NOW - 3 * DAY_MS,
          answer( {
            Reach: 1
          } ),
          NOW - 30 * 60 * 1000
        );
        const stale = {
          ...fresh,
          askedAt: NOW - 2 * 60 * 60 * 1000
        };
        const settled = withAnswer(
          undefined,
          NOW - 9 * DAY_MS,
          answer( {
            Reach: 1
          } ),
          NOW - 1 * DAY_MS
        );
        const state: StatsState = {
          posts: {
            fresh,
            stale,
            settled
          },
          unsupported: null
        };

        expect( dueOnLook(
          [
            post(
              "fresh",
              3
            ),
            post(
              "stale",
              3
            ),
            post(
              "settled",
              9
            ),
            post(
              "new",
              0.2
            ),
            post(
              "never",
              2
            ),
            post(
              "bsky",
              5,
              "bluesky"
            )
          ],
          state,
          NOW,
          BASE
        ).map( ( p ) => p.postId ) ).toEqual( [
          "stale",
          "never"
        ] );
      }
    );
  }
);

describe(
  "reading Postiz",
  () => {
    beforeEach( () => clearStats() );

    it(
      "asks one post at a time and keeps what each answered",
      async() => {
        const asked: string[] = [];
        const outcome = await readPosts(
          {
            apiBase: BASE,
            postAnalytics: async( id: string ) => {
              asked.push( id );

              return id === "empty" ? {
                kind: "none"
              } : answer( {
                Reach: 1000
              } );
            }
          },
          [
            post(
              "a",
              9
            ),
            post(
              "empty",
              9
            )
          ],
          () => NOW
        );

        expect( asked ).toEqual( [
          "a",
          "empty"
        ] );
        expect( outcome ).toEqual( {
          asked: 2,
          figures: 1,
          stopped: null
        } );
        expect( getStats().posts.a.settled?.figures[ 0 ].value ).toBe( 1000 );
        expect( getStats().posts.empty ).toEqual( {
          publishedAt: NOW - 9 * DAY_MS,
          askedAt: NOW,
          empty: "none"
        } );
      }
    );

    it(
      "stops at a Postiz without the route and remembers it, and forgets once it answers",
      async() => {
        let calls = 0;
        const outcome = await readPosts(
          {
            apiBase: BASE,
            postAnalytics: async() => {
              calls += 1;
              throw new PostizError(
                "Postiz: Cannot GET",
                404
              );
            }
          },
          [
            post(
              "a",
              9
            ),
            post(
              "b",
              9
            )
          ],
          () => NOW
        );

        expect( calls ).toBe( 1 );
        expect( outcome.stopped ).toBe( NO_ROUTE );
        expect( getStats().unsupported ).toEqual( {
          base: BASE,
          at: NOW
        } );

        await readPosts(
          {
            apiBase: BASE,
            postAnalytics: async() => answer( {
              Reach: 1
            } )
          },
          [
            post(
              "a",
              9
            )
          ],
          () => NOW
        );
        expect( getStats().unsupported ).toBeNull();
      }
    );

    it(
      "stops on a refused key or no answer, saying why, and keeps what it had",
      async() => {
        keepAnswer(
          "a",
          NOW - 9 * DAY_MS,
          answer( {
            Reach: 7
          } ),
          NOW - DAY_MS
        );
        markUnsupported(
          null,
          NOW
        );

        const outcome = await readPosts(
          {
            apiBase: BASE,
            postAnalytics: async() => {
              throw new PostizError(
                "Postiz refused the API key — paste it again from its Settings › Public API.",
                401
              );
            }
          },
          [
            post(
              "b",
              9
            )
          ],
          () => NOW
        );

        expect( outcome ).toEqual( {
          asked: 0,
          figures: 0,
          stopped: "Postiz refused the API key — paste it again from its Settings › Public API."
        } );
        expect( getStats().posts.a.settled?.figures[ 0 ].value ).toBe( 7 );
        expect( getStats().posts.b ).toBeUndefined();
      }
    );
  }
);
