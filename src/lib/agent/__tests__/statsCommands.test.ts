/**
 * stats.*: post statistics read from the tab — figures as given, floors said.
 */
import {
  DEFAULT_PHRASES
} from "@/lib/postiz/pills";
import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  planCommands
} from "../commands/planCommands";
import {
  statsCommands
} from "../commands/statsCommands";
import {
  clearPlanStore
} from "../../planner/planStore";
import {
  PostizClient
} from "../../postiz/client";
import {
  addPublication, resetPublishStore
} from "../../postiz/publishStore";
import {
  DEFAULT_RHYTHM
} from "../../postiz/rhythm";
import type {
  PostizConnection
} from "../../postiz/store";
import {
  clearStatsLevel, setStatsLevel
} from "../../stats/settings";
import {
  clearStats, getStats
} from "../../stats/store";
import {
  fakeHandles
} from "./fakeHandles";

const DAY = 86_400_000;
const NOW = Date.now();

const CATALOGUE = [
  ...Array.from(
    {
      length: 7
    },
    (
      _, i
    ) => ( {
      engine: "p5",
      category: `solo-${ i }`,
      name: `fav-${ i }`,
      createdAt: "2025-03-01",
      favorite: true
    } )
  ),
  {
    engine: "p5",
    category: "materials",
    name: "materials-v1-flame",
    createdAt: new Date( NOW - 9 * DAY ).toISOString()
      .slice(
        0,
        10
      )
  }
];

const response = (
  status: number, body: unknown
) => ( {
  ok: status < 300,
  status,
  text: async() => JSON.stringify( body )
} as unknown as Response );

let bases = 0;

/** Seven favourites posted on Instagram and Bluesky, 130 to 82 days ago (past any gap); the fifth did 3× the others. */
function setup( options: { analytics?: "ok" | "none" | "404" } = {} ) {
  // `recentPosts` keeps a Postiz's calendar for a minute: a Postiz of its own per test.
  const conn: PostizConnection = {
    apiBase: `https://postiz-${ bases++ }.example/api/public/v1`,
    apiKey: "KEY",
    channels: [
      {
        id: "ig",
        name: "Steeve Pommier",
        identifier: "instagram",
        picture: null,
        disabled: false,
        handle: null
      },
      {
        id: "bsky",
        name: "steeve.bsky",
        identifier: "bluesky",
        picture: null,
        disabled: false,
        handle: null
      }
    ],
    defaultChannelIds: [
      "ig"
    ],
    collaborator: "",
    handles: {},
    usual: {},
    rhythm: DEFAULT_RHYTHM,
    phrases: DEFAULT_PHRASES,
    dayStart: null,
    connectedAt: 0
  };
  const calls: string[] = [];
  const mode = options.analytics ?? "ok";
  const client = new PostizClient(
    conn.apiBase,
    conn.apiKey,
    async( input ) => {
      const path = input.slice( conn.apiBase.length );

      calls.push( path );

      if ( path.startsWith( "/posts?" ) ) {
        return response(
          200,
          {
            posts: []
          }
        );
      }

      const post = /^\/analytics\/post\/ig-(\d)/.exec( path );

      if ( post ) {
        if ( mode === "404" ) {
          return response(
            404,
            {
              message: "Cannot GET /public/v1/analytics/post"
            }
          );
        }

        return response(
          200,
          mode === "none" ? [] : [
            {
              label: "Reach",
              percentageChange: 0,
              data: [
                {
                  total: post[ 1 ] === "4" ? "3000" : "1000",
                  date: "2026-11-20"
                }
              ]
            },
            {
              label: "Saves",
              percentageChange: 0,
              data: [
                {
                  total: "20",
                  date: "2026-11-20"
                }
              ]
            },
            {
              label: "Shares",
              percentageChange: 0,
              data: [
                {
                  total: "10",
                  date: "2026-11-20"
                }
              ]
            }
          ]
        );
      }

      if ( path.startsWith( "/analytics/ig" ) ) {
        return response(
          200,
          [
            {
              label: "Follower Count",
              percentageChange: 5,
              data: [
                {
                  total: 2,
                  date: "2026-11-19"
                },
                {
                  total: 4,
                  date: "2026-11-20"
                }
              ]
            }
          ]
        );
      }

      return response(
        200,
        []
      );
    }
  );
  const fake = fakeHandles(
    {},
    {}
  );

  fake.handles.navigation.catalogue = () => CATALOGUE;
  fake.handles.navigation.currentSketch = () => "p5/solo-4/fav-4";
  fake.handles.publish = {
    ...fake.handles.publish,
    connection: () => conn,
    client: () => client
  };

  for ( let i = 0; i < 7; i++ ) {
    const at = NOW - ( 130 - i * 8 ) * DAY;

    addPublication(
      `p5/fav-${ i }`,
      {
        postIds: [
          `ig-${ i }`,
          `bsky-${ i }`
        ],
        posts: [
          {
            postId: `ig-${ i }`,
            channelId: "ig",
            story: false
          },
          {
            postId: `bsky-${ i }`,
            channelId: "bsky",
            story: false
          }
        ],
        channelIds: [
          "ig",
          "bsky"
        ],
        kind: "reel",
        variantName: "Reel",
        files: 1,
        at: new Date( at ).toISOString(),
        target: "schedule",
        sentAt: at - DAY
      }
    );
  }

  const registry = createCommandRegistry();

  registry.register( [
    ...statsCommands( fake.handles ),
    ...planCommands( fake.handles )
  ] );

  return {
    registry,
    calls,
    analyticsCalls: () => calls.filter( ( c ) => c.startsWith( "/analytics/post/" ) )
  };
}

describe(
  "stats commands",
  () => {
    beforeEach( () => {
      resetPublishStore();
      clearStats();
      clearStatsLevel();
      clearPlanStore();
    } );

    it(
      "are off by default: status answers, everything else refuses and asks Postiz nothing",
      async() => {
        const {
          registry, calls
        } = setup();
        const status = await registry.execute(
          "stats.status",
          {}
        ) as { level: string;
          networks: Record<string, string>;
          kept: { posts: number }; };

        expect( status.level ).toBe( "off" );
        expect( status.kept.posts ).toBe( 0 );
        expect( status.networks.Bluesky ).toMatch( /^nothing/ );

        for ( const id of [
          "stats.read",
          "stats.sketch",
          "stats.summary",
          "stats.accounts"
        ] ) {
          await expect( registry.execute(
            id,
            {}
          ) ).rejects.toMatchObject( {
            code: "unavailable",
            message: expect.stringMatching( /statistics are off/ )
          } );
        }

        await expect( registry.execute(
          "stats.post",
          {
            id: "ig-0"
          }
        ) ).rejects.toMatchObject( {
          code: "unavailable"
        } );
        expect( calls ).toEqual( [] );
        await expect( registry.execute(
          "stats.set",
          {
            level: "everything"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );

    it(
      "read what is due once, never Bluesky, and not again within the delay",
      async() => {
        const {
          registry, analyticsCalls
        } = setup();

        await registry.execute(
          "stats.set",
          {
            level: "show"
          }
        );

        const first = await registry.execute(
          "stats.read",
          {}
        ) as { asked: number;
          figures: number;
          left: number;
          notRead: number;
          stopped: string | null; };

        expect( first ).toMatchObject( {
          asked: 7,
          figures: 7,
          stopped: null,
          left: 0,
          notRead: 7
        } );
        // The oldest first, one request a post, none for Bluesky.
        expect( analyticsCalls() ).toEqual( [
          0,
          1,
          2,
          3,
          4,
          5,
          6
        ].map( ( i ) => `/analytics/post/ig-${ i }?date=7` ) );
        expect( Object.keys( getStats().posts ) ).toHaveLength( 7 );
        expect( await registry.execute(
          "stats.read",
          {}
        ) ).toMatchObject( {
          asked: 0
        } );
        expect( analyticsCalls() ).toHaveLength( 7 );
      }
    );

    it(
      "give a sketch's figures as the network gave them, with their date and the floor",
      async() => {
        const {
          registry
        } = setup();

        setStatsLevel( "show" );
        await registry.execute(
          "stats.read",
          {}
        );

        const sheet = await registry.execute(
          "stats.sketch",
          {}
        ) as { sketch: string;
          sends: { slot: string;
            pillar: string;
            timesUsual: number | null;
            accounts: Record<string, unknown>[]; }[]; };

        expect( sheet.sketch ).toBe( "p5/solo-4/fav-4" );
        expect( sheet.sends ).toHaveLength( 1 );
        expect( sheet.sends[ 0 ] ).toMatchObject( {
          pillar: "favourite",
          timesUsual: 3
        } );
        expect( sheet.sends[ 0 ].accounts[ 0 ] ).toMatchObject( {
          account: "Steeve Pommier",
          network: "Instagram",
          postId: "ig-4",
          state: expect.stringMatching( /^settled/ ),
          figures: {
            Reach: 3000,
            Saves: 20,
            Shares: 10
          },
          headline: "Reach 3000",
          rate: "1 saves + shares per 100 reached",
          timesUsual: 3,
          usual: {
            of: "Reach",
            value: 1000,
            posts: 7
          }
        } );
        expect( typeof sheet.sends[ 0 ].accounts[ 0 ].readAt ).toBe( "string" );
        expect( sheet.sends[ 0 ].accounts[ 1 ] ).toMatchObject( {
          network: "Bluesky",
          state: "Postiz reads no figure from this network",
          timesUsual: null
        } );
        expect( sheet.sends[ 0 ].accounts[ 1 ] ).not.toHaveProperty( "figures" );

        const post = await registry.execute(
          "stats.post",
          {
            id: "ig-4"
          }
        ) as { settled: { figures: Record<string, number> } | null;
          early: unknown; };

        expect( post.settled?.figures.Reach ).toBe( 3000 );
        expect( post.early ).toBeNull();
        await expect( registry.execute(
          "stats.post",
          {
            id: "nope"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        await expect( registry.execute(
          "stats.sketch",
          {
            sketch: "p5/nope/nope"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );

    it(
      "say «too few» instead of a figure, and give one account its raw medians",
      async() => {
        const {
          registry
        } = setup();

        setStatsLevel( "show" );
        await registry.execute(
          "stats.read",
          {}
        );

        const summary = await registry.execute(
          "stats.summary",
          {
            by: "series"
          }
        ) as { measuredSends: number;
          rows: Record<string, unknown>[];
          accounts: Record<string, unknown>[];
          listening: { level: string;
            moving: string[]; }; };

        expect( summary.measuredSends ).toBe( 7 );
        // Seven series of one post each: none may speak.
        expect( summary.rows ).toHaveLength( 7 );
        expect( summary.rows.every( ( r ) => r.tooFew === true && !( "timesUsual" in r ) ) ).toBe( true );
        expect( summary.accounts ).toEqual( [
          {
            id: "ig",
            account: "Steeve Pommier",
            network: "Instagram",
            usual: 1000,
            of: "Reach",
            settledPosts: 7
          }
        ] );
        expect( summary.listening ).toMatchObject( {
          level: "show",
          moving: []
        } );

        const pillar = await registry.execute(
          "stats.summary",
          {
            account: "ig"
          }
        ) as { rows: Record<string, unknown>[] };

        expect( pillar.rows ).toEqual( [
          {
            group: "Favourite",
            posts: 7,
            medianReach: 1000,
            savesPlusSharesPer100: 3
          }
        ] );
        await expect( registry.execute(
          "stats.summary",
          {
            account: "bsky"
          }
        ) ).resolves.toMatchObject( {
          rows: []
        } );
        await expect( registry.execute(
          "stats.summary",
          {
            account: "nobody"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );

    it(
      "let plan.get say what the listening moved, and nothing when it is off",
      async() => {
        const {
          registry
        } = setup();
        const get = async() => await registry.execute(
          "plan.get",
          {}
        ) as { listening: { level: string;
          measured: number;
          moving: string[];
          note: string; };
        slots: { sketch?: string;
          pillar?: string;
          why?: string;
          heard?: string; }[]; };
        const off = await get();

        expect( off.listening ).toMatchObject( {
          level: "off",
          measured: 0,
          moving: []
        } );

        setStatsLevel( "listen" );
        await registry.execute(
          "stats.read",
          {}
        );

        const heard = await get();
        const favourites = ( plan: typeof heard ) => plan.slots.flatMap( ( s ) => s.pillar === "favourite" && s.sketch ? [
          s.sketch.split( "/" ).pop()
        ] : [] );

        expect( heard.listening ).toMatchObject( {
          level: "listen",
          measured: 7
        } );
        expect( heard.listening.moving[ 0 ] ).toMatch( /^1 favourite has a post far enough from your usual/ );
        // The fifth favourite, the one that did 3×, comes back three places sooner.
        expect( favourites( off ).indexOf( "fav-4" ) - favourites( heard ).indexOf( "fav-4" ) ).toBe( 3 );
        expect( heard.slots.find( ( s ) => s.sketch === "p5/solo-4/fav-4" )?.why ).toMatch( /moved up 3 places: its post of .* did 3\.0× your usual \(Instagram 3,000 reached, at 7 days or more\)$/ );

        expect( heard.slots.find( ( s ) => s.sketch === "p5/solo-4/fav-4" )?.heard ).toMatch( /^moved up 3 places/ );
        expect( off.slots.some( ( s ) => "heard" in s ) ).toBe( false );

        setStatsLevel( "off" );
        expect( ( await get() ).slots ).toEqual( off.slots );
      }
    );

    it(
      "handle a Postiz that has no figure, and one that has no analytics at all",
      async() => {
        const none = setup( {
          analytics: "none"
        } );

        setStatsLevel( "show" );
        expect( await none.registry.execute(
          "stats.read",
          {}
        ) ).toMatchObject( {
          asked: 7,
          figures: 0,
          stopped: null
        } );

        const sheet = await none.registry.execute(
          "stats.sketch",
          {}
        ) as { sends: { timesUsual: number | null;
          accounts: Record<string, unknown>[]; }[]; };

        expect( sheet.sends[ 0 ].timesUsual ).toBeNull();
        expect( sheet.sends[ 0 ].accounts[ 0 ] ).toMatchObject( {
          state: "asked, and Postiz had no figure",
          timesUsual: null
        } );
        expect( sheet.sends[ 0 ].accounts[ 0 ] ).not.toHaveProperty( "figures" );

        clearStats();
        resetPublishStore();

        const old = setup( {
          analytics: "404"
        } );
        const stopped = await old.registry.execute(
          "stats.read",
          {}
        ) as { asked: number;
          stopped: string; };

        expect( stopped.asked ).toBe( 0 );
        expect( stopped.stopped ).toMatch( /no analytics in its public API/ );
        // One question was enough: it is not asked again for a day.
        expect( old.analyticsCalls() ).toHaveLength( 1 );
        await old.registry.execute(
          "stats.read",
          {}
        );
        expect( old.analyticsCalls() ).toHaveLength( 1 );
        expect( await old.registry.execute(
          "stats.status",
          {}
        ) ).toMatchObject( {
          problem: expect.stringMatching( /no analytics route/ )
        } );
      }
    );

    it(
      "read each account's own numbers on demand, without Postiz's constant",
      async() => {
        const {
          registry, calls
        } = setup();

        setStatsLevel( "show" );

        const accounts = await registry.execute(
          "stats.accounts",
          {
            days: 30
          }
        ) as { accounts: Record<string, unknown>[] };

        expect( calls ).toEqual( [
          "/analytics/ig?date=30",
          "/analytics/bsky?date=30"
        ] );
        expect( accounts.accounts[ 0 ] ).toMatchObject( {
          id: "ig",
          figures: {
            "Follower Count": 4
          },
          dated: "2026-11-20"
        } );
        expect( accounts.accounts[ 1 ] ).toMatchObject( {
          id: "bsky",
          figures: {},
          note: "Postiz gave no figure for this account"
        } );
        expect( JSON.stringify( accounts ) ).not.toMatch( /percentage/i );
      }
    );
  }
);
