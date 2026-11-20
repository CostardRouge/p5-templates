import metadata from "../../../sketches/metadata.json";
import type {
  GallerySend
} from "../../gallery/sends";
import type {
  Provider
} from "../../postiz/client";
import {
  DEFAULT_RHYTHM, zonedInstant
} from "../../postiz/rhythm";
import {
  EMPTY_CHOICES, planSlots, sketchKeyOf, type PlanInput, type PlanSketch, type PlanSlot
} from "../../planner/planner";
import {
  planFreeSlots
} from "../../planner/slots";
import {
  listening
} from "../listen";
import {
  candidatesOf, groups, measure, MIN_GROUP, MIN_USUAL, OFF_SLOT, slotOf
} from "../measure";
import {
  boundedOrder, MAX_SHIFT, planSignal, quietReason, signalFacts, signalLines
} from "../signal";
import {
  DAY_MS, type StatsState
} from "../store";

const NOW = Date.parse( "2026-11-20T12:00:00Z" );
const CATALOGUE = metadata as PlanSketch[];

/** The rhythm's slot on its own wall clock, `weeks` weeks before the given day — whatever daylight saving does in between. */
function slotBefore(
  day: [ number, number, number ], time: [ number, number ], weeks: number
): number {
  const date = new Date( Date.UTC(
    day[ 0 ],
    day[ 1 ] - 1,
    day[ 2 ] - weeks * 7
  ) );

  return zonedInstant(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    time[ 0 ],
    time[ 1 ],
    DEFAULT_RHYTHM.timeZone
  ).getTime();
}

/** A Sunday 10:00, a Tuesday 9:00 and a Friday 19:00 in Paris, `weeks` weeks before the week of 2026-11-09. */
const SLOT = {
  sun: ( weeks: number ) => slotBefore(
    [
      2026,
      11,
      15
    ],
    [
      10,
      0
    ],
    weeks
  ),
  tue: ( weeks: number ) => slotBefore(
    [
      2026,
      11,
      10
    ],
    [
      9,
      0
    ],
    weeks
  ),
  fri: ( weeks: number ) => slotBefore(
    [
      2026,
      11,
      13
    ],
    [
      19,
      0
    ],
    weeks
  )
};

interface Posted {
  sketchKey: string;
  at: number;
  /** channel → settled headline. */
  reach: Record<string, number>;
  extra?: Partial<GallerySend>;
}

const PROVIDER: Record<string, Provider> = {
  ig: "instagram",
  x: "x",
  bsky: "bluesky"
};

function world( posted: readonly Posted[] ): { sends: GallerySend[];
  state: StatsState; } {
  const state: StatsState = {
    posts: {},
    unsupported: null
  };
  const sends = posted.map( (
    p, i
  ) => {
    const accounts = Object.entries( p.reach ).map( ( [
      channelId,
      value
    ] ) => {
      const postId = `post-${ i }-${ channelId }`;

      if ( value >= 0 ) {
        state.posts[ postId ] = {
          publishedAt: p.at,
          askedAt: p.at + 8 * DAY_MS,
          settled: {
            at: p.at + 8 * DAY_MS,
            ageDays: 8,
            figures: [
              {
                label: channelId === "x" ? "Impressions" : "Reach",
                key: channelId === "x" ? "views" as const : "reach" as const,
                value
              },
              {
                label: channelId === "x" ? "Bookmarks" : "Saves",
                key: "saves" as const,
                value: value / 50
              },
              {
                label: channelId === "x" ? "Retweets" : "Shares",
                key: "shares" as const,
                value: value / 100
              }
            ]
          }
        };
      }

      return {
        postId,
        channelId,
        name: channelId,
        provider: PROVIDER[ channelId ] ?? "instagram",
        story: false,
        state: "published" as const,
        error: null,
        url: null
      };
    } );

    return {
      key: `send-${ i }`,
      sketchKey: p.sketchKey,
      pieceId: null,
      at: p.at,
      target: "schedule" as const,
      kind: "reel" as const,
      variantName: "Reel",
      accounts,
      publication: null,
      ...p.extra
    };
  } );

  return {
    sends,
    state
  };
}

function input(
  posted: readonly Posted[] = [], catalogue: readonly PlanSketch[] = CATALOGUE
): PlanInput {
  return {
    catalogue,
    slots: planFreeSlots(
      DEFAULT_RHYTHM,
      [],
      new Date( NOW )
    ),
    posted: posted.map( ( p ) => ( {
      sketchKey: p.sketchKey,
      at: p.at
    } ) ),
    choices: EMPTY_CHOICES,
    now: NOW,
    timeZone: DEFAULT_RHYTHM.timeZone
  };
}

const lines = ( plan: readonly PlanSlot[] ) => plan.map( ( s ) => `${ s.slot } ${ s.proposal?.key ?? "-" }` );

const NEW = CATALOGUE.filter( ( s ) => s.engine === "p5" && !s.favorite && !s.hiddenFromGallery && s.category );
const FAVOURITES = CATALOGUE.filter( ( s ) => s.favorite && !s.hiddenFromGallery );

describe(
  "an order moved within bounds",
  () => {
    it(
      "is the order itself when every score is equal",
      () => {
        const items = [
          "a",
          "b",
          "c",
          "d",
          "e"
        ];

        expect( boundedOrder(
          items,
          () => 1
        ) ).toEqual( items );
        expect( boundedOrder(
          [],
          () => 1
        ) ).toEqual( [] );
      }
    );

    it(
      "brings the better ones forward, never further than the bound, equals in their order",
      () => {
        const items = Array.from(
          {
            length: 10
          },
          (
            _, i
          ) => i
        );
        // The last one is by far the best: it comes forward three places, no more.
        const order = boundedOrder(
          items,
          ( i ) => i === 9 ? 5 : 1
        );

        expect( order ).toEqual( [
          0,
          1,
          2,
          3,
          4,
          5,
          9,
          6,
          7,
          8
        ] );
        // The first one is the worst: it falls three places, no more.
        expect( boundedOrder(
          items,
          ( i ) => i === 0 ? 0.2 : 1
        ) ).toEqual( [
          1,
          2,
          3,
          0,
          4,
          5,
          6,
          7,
          8,
          9
        ] );
      }
    );

    it(
      "is always a permutation within the bound, whatever the scores",
      () => {
        let seed = 12345;
        const random = () => {
          seed = ( seed * 1103515245 + 12345 ) % 2147483648;

          return seed / 2147483648;
        };

        for ( let run = 0; run < 300; run++ ) {
          const n = 1 + Math.floor( random() * 40 );
          const shift = Math.floor( random() * 5 );
          const scores = Array.from(
            {
              length: n
            },
            () => Math.round( random() * 4 ) / 2
          );
          const items = scores.map( (
            _, i
          ) => i );
          const order = boundedOrder(
            items,
            ( i ) => scores[ i ],
            shift
          );

          expect( [
            ...order
          ].sort( (
            a, b
          ) => a - b ) ).toEqual( items );
          order.forEach( (
            item, at
          ) => expect( Math.abs( item - at ) ).toBeLessThanOrEqual( shift ) );

          // Two items of one score never pass each other.
          for ( let a = 0; a < n; a++ ) {
            for ( let b = a + 1; b < n; b++ ) {
              if ( scores[ a ] === scores[ b ] ) {
                expect( order.indexOf( a ) ).toBeLessThan( order.indexOf( b ) );
              }
            }
          }
        }
      }
    );
  }
);

describe(
  "what is measured",
  () => {
    const [
      a,
      b
    ] = NEW;

    it(
      "gives an account no usual under five settled posts, and no index without one",
      () => {
        const four = world( Array.from(
          {
            length: MIN_USUAL - 1
          },
          (
            _, i
          ) => ( {
            sketchKey: sketchKeyOf( a ),
            at: SLOT.sun( i + 2 ),
            reach: {
              ig: 1000 + i
            }
          } )
        ) );
        const few = measure( {
          ...four,
          catalogue: CATALOGUE,
          rhythm: DEFAULT_RHYTHM,
          now: NOW
        } );

        expect( few.usual.get( "ig" ) ).toMatchObject( {
          posts: 4,
          value: null,
          label: "Reach"
        } );
        expect( few.sends.every( ( s ) => s.index === null ) ).toBe( true );
        expect( signalFacts(
          few,
          DEFAULT_RHYTHM
        ).measured ).toBe( 0 );
      }
    );

    it(
      "indexes each post on ITS account's usual, and a send by the median of its accounts",
      () => {
        const w = world( [
          ...[
            1000,
            1000,
            1000,
            1000,
            2000
          ].map( (
            reach, i
          ) => ( {
            sketchKey: sketchKeyOf( a ),
            at: SLOT.sun( i + 2 ),
            reach: {
              ig: reach,
              // X's impressions are another scale entirely: 100 is its usual.
              x: i === 4 ? 50 : 100
            }
          } ) )
        ] );
        const m = measure( {
          ...w,
          catalogue: CATALOGUE,
          rhythm: DEFAULT_RHYTHM,
          now: NOW
        } );
        const best = m.sends.find( ( s ) => s.at === SLOT.sun( 6 ) )!;

        expect( m.usual.get( "ig" )?.value ).toBe( 1000 );
        expect( m.usual.get( "x" ) ).toMatchObject( {
          value: 100,
          label: "Impressions"
        } );
        expect( best.accounts.map( ( acc ) => acc.index ) ).toEqual( [
          2,
          0.5
        ] );
        // 2× on one account and 0.5× on the other: the send is at 1.25×, never 2,050 «people».
        expect( best.index ).toBe( 1.25 );
        expect( best.slot ).toBe( "Sun 10:00" );
        expect( best.series ).toBe( a.category );
        expect( best.pillar ).toBe( "drop" );
      }
    );

    it(
      "leaves out a draft, a story, a queued post and a post still ahead — and never reads Bluesky",
      () => {
        const w = world( [
          {
            sketchKey: sketchKeyOf( a ),
            at: SLOT.sun( 2 ),
            reach: {
              ig: 10,
              bsky: -1
            }
          },
          {
            sketchKey: sketchKeyOf( a ),
            at: SLOT.sun( 3 ),
            reach: {
              ig: 10
            },
            extra: {
              target: "draft"
            }
          },
          {
            sketchKey: sketchKeyOf( b ),
            at: NOW + DAY_MS,
            reach: {
              ig: -1
            }
          }
        ] );

        w.sends[ 0 ].accounts.push(
          {
            ...w.sends[ 0 ].accounts[ 0 ],
            postId: "story",
            story: true
          },
          {
            ...w.sends[ 0 ].accounts[ 0 ],
            postId: "queued",
            channelId: "ig2",
            state: "queue"
          }
        );

        expect( candidatesOf(
          w.sends,
          NOW
        ).map( ( c ) => c.postId ) ).toEqual( [
          "post-0-ig",
          "post-0-bsky"
        ] );

        const m = measure( {
          ...w,
          catalogue: CATALOGUE,
          rhythm: DEFAULT_RHYTHM,
          now: NOW
        } );

        expect( m.sends ).toHaveLength( 1 );
        expect( m.sends[ 0 ].accounts.map( ( acc ) => `${ acc.provider }:${ acc.stats }` ) ).toEqual( [
          "instagram:figures",
          "bluesky:no-network"
        ] );
      }
    );

    it(
      "names the slot a post went out on, and «another time» off the rhythm",
      () => {
        expect( slotOf(
          SLOT.tue( 0 ),
          DEFAULT_RHYTHM
        ) ).toBe( "Tue 9:00" );
        expect( slotOf(
          SLOT.fri( 3 ),
          DEFAULT_RHYTHM
        ) ).toBe( "Fri 19:00" );
        expect( slotOf(
          SLOT.fri( 3 ) + 60_000,
          DEFAULT_RHYTHM
        ) ).toBe( OFF_SLOT );
      }
    );

    it(
      "says nothing of a group under three posts, and gives one account its raw medians",
      () => {
        const w = world( [
          ...[
            1000,
            1000,
            1000,
            1000,
            1000,
            3000,
            3000,
            3000
          ].map( (
            reach, i
          ) => ( {
            sketchKey: sketchKeyOf( i < 5 ? a : NEW.find( ( s ) => s.category !== a.category )! ),
            at: i === 0 ? SLOT.tue( 2 ) : SLOT.sun( i + 2 ),
            reach: {
              ig: reach
            }
          } ) )
        ] );
        const m = measure( {
          ...w,
          catalogue: CATALOGUE,
          rhythm: DEFAULT_RHYTHM,
          now: NOW
        } );
        const bySlot = groups(
          m.sends,
          "slot"
        );
        const tue = bySlot.find( ( r ) => r.id === "Tue 9:00" )!;
        const raw = groups(
          m.sends,
          "series",
          "ig"
        );

        expect( tue ).toMatchObject( {
          posts: 1,
          thin: true,
          index: null,
          head: null
        } );
        expect( bySlot.find( ( r ) => r.id === "Sun 10:00" ) ).toMatchObject( {
          posts: 7,
          thin: false
        } );
        expect( raw.map( ( r ) => `${ r.posts }:${ r.head }` ) ).toEqual( [
          "5:1000",
          "3:3000"
        ] );
        // Saves + shares per 100 reached: 2 + 1.
        expect( raw[ 0 ].rate ).toBeCloseTo(
          3,
          6
        );
        expect( raw[ 0 ].index ).toBeNull();
        expect( MIN_GROUP ).toBe( 3 );
      }
    );
  }
);

describe(
  "the Plan that listens",
  () => {
    const baseline = planSlots( input() );

    it(
      "proposes on the real catalogue (the proof below compares something)",
      () => {
        expect( baseline.length ).toBeGreaterThan( 10 );
        expect( baseline.filter( ( s ) => s.proposal ).length ).toBe( baseline.length );
      }
    );

    it(
      "is EXACTLY the plan of before when the switch is off, when it only shows, and when nothing is measured",
      () => {
        const nothing = world( [] );
        // Posts, with figures — but none settled on an account with five: under every floor.
        const thin = world( FAVOURITES.slice(
          0,
          4
        ).map( (
          s, i
        ) => ( {
          sketchKey: sketchKeyOf( s ),
          at: SLOT.sun( i + 10 ),
          reach: {
            ig: 500 * ( i + 1 )
          }
        } ) ) );

        for ( const level of [
          "off",
          "show",
          "listen"
        ] as const ) {
          const l = listening( {
            ...nothing,
            catalogue: CATALOGUE,
            rhythm: DEFAULT_RHYTHM,
            now: NOW,
            level
          } );

          expect( Boolean( l.signal ) ).toBe( level === "listen" );
          expect( planSlots( {
            ...input(),
            signal: l.signal
          } ) ).toEqual( baseline );
        }

        const posted = input( FAVOURITES.slice(
          0,
          4
        ).map( (
          s, i
        ) => ( {
          sketchKey: sketchKeyOf( s ),
          at: SLOT.sun( i + 10 ),
          reach: {}
        } ) ) );
        const quiet = listening( {
          ...thin,
          catalogue: CATALOGUE,
          rhythm: DEFAULT_RHYTHM,
          now: NOW,
          level: "listen"
        } );

        expect( quiet.facts.measured ).toBe( 0 );
        expect( signalLines( quiet.facts ) ).toEqual( [] );
        expect( quietReason( quiet.facts ) ).toMatch( /^No post is measured yet/ );
        expect( planSlots( {
          ...posted,
          signal: quiet.signal
        } ) ).toEqual( planSlots( posted ) );
      }
    );

    it(
      "ignores a signal that hands back anything but the same sketches and pillars",
      () => {
        expect( planSlots( {
          ...input(),
          signal: {
            order: (
              _pillar, pool
            ) => pool.slice( 1 ),
            pillars: ( turns ) => turns.map( () => "favourite" as const ),
            why: () => null
          }
        } ) ).toEqual( baseline );
        expect( planSlots( {
          ...input(),
          signal: {
            order: (
              _pillar, pool
            ) => [
              ...pool,
              pool[ 0 ]
            ]
          }
        } ) ).toEqual( baseline );
      }
    );

    /**
     * A small catalogue of its own, so these do not move when a sketch is added:
     * twelve favourites of twelve series, three series of new sketches (A the
     * newest, then B, then C), and old sketches that were posted.
     */
    const made = (
      name: string, category: string, createdAt: string, extra: Partial<PlanSketch> = {}
    ): PlanSketch => ( {
      engine: "p5",
      name,
      category,
      createdAt,
      ...extra
    } );
    const FAVS = Array.from(
      {
        length: 12
      },
      (
        _, i
      ) => made(
        `fav-${ String( i ).padStart(
          2,
          "0"
        ) }`,
        `solo-${ i }`,
        "2025-03-01",
        {
          favorite: true
        }
      )
    );
    const OLD = [
      1,
      2,
      3,
      4,
      5,
      6
    ].map( ( n ) => made(
      `c-v${ n }`,
      "c",
      "2025-06-01"
    ) );
    const FRESH = [
      ...[
        1,
        2,
        3,
        4
      ].map( ( n ) => made(
        `a-v${ n }`,
        "a",
        "2026-11-12"
      ) ),
      ...[
        1,
        2,
        3,
        4
      ].map( ( n ) => made(
        `b-v${ n }`,
        "b",
        "2026-11-08"
      ) ),
      ...[
        7,
        8,
        9,
        10
      ].map( ( n ) => made(
        `c-v${ n }`,
        "c",
        "2026-11-04"
      ) )
    ];
    const SMALL = [
      ...FAVS,
      ...OLD,
      ...FRESH
    ];
    const hear = (
      w: { sends: GallerySend[];
        state: StatsState; }, level: "off" | "show" | "listen" = "listen"
    ) => listening( {
      ...w,
      catalogue: SMALL,
      rhythm: DEFAULT_RHYTHM,
      now: NOW,
      level
    } );
    const keys = (
      plan: readonly PlanSlot[], pillar: string
    ) => plan.flatMap( ( s ) => s.proposal?.pillar === pillar ? [
      s.proposal.sketchKey.split( "/" )[ 1 ]
    ] : [] );

    /** The twelve favourites, each posted long ago in their order: `best` did 3× the others, `worst` a third. */
    function favouritesPosted(
      best = -1, worst = -1
    ): Posted[] {
      return FAVS.map( (
        s, i
      ) => ( {
        sketchKey: sketchKeyOf( s ),
        at: SLOT.sun( 20 + ( 12 - i ) ),
        reach: {
          ig: i === best ? 3000 : i === worst ? 300 : 1000
        }
      } ) );
    }

    it(
      "brings a favourite that did well back sooner — three places at most — and says on which figures",
      () => {
        const posted = favouritesPosted( 4 );
        const plain = planSlots( input(
          posted,
          SMALL
        ) );
        const l = hear( world( posted ) );
        const heard = planSlots( {
          ...input(
            posted,
            SMALL
          ),
          signal: l.signal
        } );

        expect( l.facts.measured ).toBe( 12 );
        // Without listening it is the fifth favourite to come back; with, the second.
        expect( keys(
          plain,
          "favourite"
        ).slice(
          0,
          5
        ) ).toEqual( [
          "fav-00",
          "fav-01",
          "fav-02",
          "fav-03",
          "fav-04"
        ] );
        expect( keys(
          heard,
          "favourite"
        ).slice(
          0,
          5
        ) ).toEqual( [
          "fav-00",
          "fav-04",
          "fav-01",
          "fav-02",
          "fav-03"
        ] );
        expect( 4 - 1 ).toBe( MAX_SHIFT );
        expect( heard.find( ( s ) => s.proposal?.sketchKey === "p5/fav-04" )!.proposal!.why ).toMatch( /^A favourite · last posted .* · moved up 3 places: its post of \d+ \w+ did 3\.0× your usual \(Instagram 3,000 reached, at 7 days or more\)$/ );
        // The ones that only made room keep their line as it was.
        expect( heard.filter( ( s ) => /moved/.test( s.proposal?.why ?? "" ) ) ).toHaveLength( 1 );
        expect( heard.find( ( s ) => s.proposal?.sketchKey === "p5/fav-01" )!.proposal!.why ).toBe( plain.find( ( s ) => s.proposal?.sketchKey === "p5/fav-01" )!.proposal!.why );
        // The same slots, the same pillars on them, the same new sketches: an order, nothing added, nothing scheduled.
        expect( heard.map( ( s ) => `${ s.slot } ${ s.proposal?.pillar }` ) ).toEqual( plain.map( ( s ) => `${ s.slot } ${ s.proposal?.pillar }` ) );
        expect( keys(
          heard,
          "drop"
        ) ).toEqual( keys(
          plain,
          "drop"
        ) );
        expect( signalLines( l.facts )[ 0 ] ).toBe( "1 favourite has a post far enough from your usual to move it when it comes back (at most 3 places)" );
        // The signal's words stand alone too, for the line's mark and for an agent.
        expect( heard.find( ( s ) => s.proposal?.sketchKey === "p5/fav-04" )!.proposal!.heard ).toMatch( /^moved up 3 places: its post of/ );
        expect( heard.filter( ( s ) => s.proposal?.heard ) ).toHaveLength( 1 );
        expect( plain.some( ( s ) => s.proposal && "heard" in s.proposal ) ).toBe( false );
      }
    );

    it(
      "returns to the plan of before the moment the switch goes off",
      () => {
        const posted = favouritesPosted( 4 );
        const w = world( posted );
        const plain = planSlots( input(
          posted,
          SMALL
        ) );
        const at = ( level: "off" | "show" | "listen" ) => planSlots( {
          ...input(
            posted,
            SMALL
          ),
          signal: hear(
            w,
            level
          ).signal
        } );

        expect( lines( at( "listen" ) ) ).not.toEqual( lines( plain ) );
        expect( at( "show" ) ).toEqual( plain );
        expect( at( "off" ) ).toEqual( plain );
      }
    );

    it(
      "pushes back a favourite that did badly, and leaves one near the usual where it was",
      () => {
        const posted = favouritesPosted(
          -1,
          0
        );
        const w = world( posted );

        // The second favourite did 1.1× the usual — inside the edge, so it counts as the usual.
        w.state.posts[ "post-1-ig" ].settled!.figures[ 0 ].value = 1100;

        const heard = planSlots( {
          ...input(
            posted,
            SMALL
          ),
          signal: hear( w ).signal
        } );

        expect( keys(
          heard,
          "favourite"
        ).slice(
          0,
          5
        ) ).toEqual( [
          "fav-01",
          "fav-02",
          "fav-03",
          "fav-00",
          "fav-04"
        ] );
        expect( heard.find( ( s ) => s.proposal?.sketchKey === "p5/fav-00" )!.proposal!.why ).toMatch( /moved down 3 places: its post of \d+ \w+ did 0\.3× your usual \(Instagram 300 reached, at 7 days or more\)$/ );
        expect( heard.filter( ( s ) => /moved/.test( s.proposal?.why ?? "" ) ) ).toHaveLength( 1 );
      }
    );

    it(
      "moves a new sketch by its SERIES' result, the series keeping its own order",
      () => {
        // Three old sketches of series C did 2× the usual that five favourites set.
        const posted: Posted[] = [
          ...OLD.slice(
            0,
            3
          ).map( (
            s, i
          ) => ( {
            sketchKey: sketchKeyOf( s ),
            at: SLOT.sun( 30 + i ),
            reach: {
              ig: 2000
            }
          } ) ),
          ...FAVS.slice(
            0,
            5
          ).map( (
            s, i
          ) => ( {
            sketchKey: sketchKeyOf( s ),
            at: SLOT.sun( 40 + i ),
            reach: {
              ig: 1000
            }
          } ) )
        ];
        const l = hear( world( posted ) );
        const plain = planSlots( input(
          posted,
          SMALL
        ) );
        const heard = planSlots( {
          ...input(
            posted,
            SMALL
          ),
          signal: l.signal
        } );

        expect( l.facts.series.get( "c" ) ).toMatchObject( {
          posts: 3,
          index: 2
        } );
        // The series in turn, newest first — then C's sketches come forward, still v7 before v8.
        expect( keys(
          plain,
          "drop"
        ).slice(
          0,
          6
        ) ).toEqual( [
          "a-v1",
          "b-v1",
          "c-v7",
          "a-v2",
          "b-v2",
          "c-v8"
        ] );
        expect( keys(
          heard,
          "drop"
        ).slice(
          0,
          6
        ) ).toEqual( [
          "c-v7",
          "a-v1",
          "c-v8",
          "b-v1",
          "a-v2",
          "c-v9"
        ] );
        expect( heard.find( ( s ) => s.proposal?.sketchKey === "p5/c-v7" )!.proposal!.why ).toMatch( /moved up 2 places: C posts do 2\.0× your usual \(median of 3\)$/ );
        // The three old ones did well, but a new sketch that went out is never proposed again: only the series speaks.
        expect( signalLines( l.facts ) ).toEqual( [
          "C posts do 2.0× your usual (median of 3): its unposted sketches move up"
        ] );
      }
    );

    it(
      "puts the stronger pillar on the week's strongest slot by swapping two turns, the mix keeping its counts",
      () => {
        // Sundays did twice the Fridays, and new sketches twice the favourites. Tuesdays have two posts: too few to speak.
        const posted: Posted[] = [
          ...OLD.map( (
            s, i
          ) => ( {
            sketchKey: sketchKeyOf( s ),
            at: SLOT.sun( 30 + i ),
            reach: {
              ig: 2000
            }
          } ) ),
          ...FAVS.slice(
            0,
            6
          ).map( (
            s, i
          ) => ( {
            sketchKey: sketchKeyOf( s ),
            at: i < 2 ? SLOT.tue( 30 + i ) : SLOT.fri( 30 + i ),
            reach: {
              ig: 1000
            }
          } ) )
        ];
        const l = hear( world( posted ) );
        const plain = planSlots( input(
          posted,
          SMALL
        ) );
        const heard = planSlots( {
          ...input(
            posted,
            SMALL
          ),
          signal: l.signal
        } );
        const count = (
          plan: readonly PlanSlot[], pillar: string
        ) => plan.filter( ( s ) => s.proposal?.pillar === pillar ).length;
        const on = (
          plan: readonly PlanSlot[], slot: string
        ) => plan.filter( ( s ) => slotOf(
          s.at.getTime(),
          DEFAULT_RHYTHM
        ) === slot ).map( ( s ) => s.proposal?.pillar );

        expect( l.facts.slot ).toMatchObject( {
          id: "Sun 10:00",
          posts: 6,
          over: {
            id: "Fri 19:00",
            posts: 4
          }
        } );
        expect( l.facts.pillar ).toMatchObject( {
          id: "drop",
          posts: 6,
          over: {
            id: "favourite",
            posts: 6
          }
        } );
        // Balanced gives two Sundays a favourite; listening, each takes the new sketch of its week — a series' Sunday stays a series'.
        expect( on(
          plain,
          "Sun 10:00"
        ) ).toEqual( [
          "favourite",
          "series",
          "favourite",
          "series",
          "drop"
        ] );
        expect( on(
          heard,
          "Sun 10:00"
        ) ).toEqual( [
          "drop",
          "series",
          "drop",
          "series",
          "drop"
        ] );

        for ( const pillar of [
          "drop",
          "favourite",
          "series",
          "recap"
        ] ) {
          expect( count(
            heard,
            pillar
          ) ).toBe( count(
            plain,
            pillar
          ) );
        }

        const swapped = heard.filter( ( s ) => /strongest slot/.test( s.proposal?.why ?? "" ) );

        // Two weeks, two turns each.
        expect( swapped ).toHaveLength( 4 );
        expect( swapped.find( ( s ) => slotOf(
          s.at.getTime(),
          DEFAULT_RHYTHM
        ) === "Sun 10:00" )!.proposal!.why ).toMatch( /Sun 10:00 is your strongest slot \(1\.3× your usual over 6 posts, Fri 19:00 0\.7× over 4\) and new sketches do better than favourites \(1\.3× over 6 against 0\.7× over 6\): this week's turn was swapped to bring one here$/ );
        expect( swapped.find( ( s ) => slotOf(
          s.at.getTime(),
          DEFAULT_RHYTHM
        ) === "Fri 19:00" )!.proposal!.why ).toMatch( /swapped turns with Sun 10:00, your strongest slot \(1\.3× your usual over 6 posts\), where new sketches go first$/ );
        expect( signalLines( l.facts ).some( ( line ) => /each week one turn is swapped/.test( line ) ) ).toBe( true );
      }
    );

    it(
      "builds the same signal for the gallery and for an agent (one reading)",
      () => {
        const posted = favouritesPosted( 4 );
        const w = world( posted );
        const facts = signalFacts(
          measure( {
            ...w,
            catalogue: SMALL,
            rhythm: DEFAULT_RHYTHM,
            now: NOW
          } ),
          DEFAULT_RHYTHM
        );

        expect( planSlots( {
          ...input(
            posted,
            SMALL
          ),
          signal: planSignal(
            facts,
            DEFAULT_RHYTHM,
            SMALL
          )
        } ) ).toEqual( planSlots( {
          ...input(
            posted,
            SMALL
          ),
          signal: hear( w ).signal
        } ) );
      }
    );
  }
);
