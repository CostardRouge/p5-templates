import {
  dropPool, EMPTY_CHOICES, favouritePool, monthRecap, planSlots, rendezvous, sampleReel, seriesPool, tooSoon, versionOf, yearRecap, type PlanChoices, type PlanSketch
} from "../planner";
import {
  reelCaption, reelDocument, reelSeconds
} from "../reel";
import parseImportedOptions from "../../../utils/parseImportedOptions";
import {
  readChoices
} from "../planStore";
import {
  planFreeSlots
} from "../slots";
import {
  DEFAULT_RHYTHM
} from "../../postiz/rhythm";

const NOW = Date.parse( "2026-11-20T12:00:00Z" );
const WEEK = 7 * 86_400_000;

const sketch = (
  name: string, category: string, createdAt: string, extra: Partial<PlanSketch> = {}
): PlanSketch => ( {
  engine: "p5",
  name,
  category,
  createdAt,
  ...extra
} );

const CATALOGUE: PlanSketch[] = [
  sketch(
    "materials-v2-water",
    "materials",
    "2026-11-11"
  ),
  sketch(
    "materials-v1-flame",
    "materials",
    "2026-11-10"
  ),
  sketch(
    "iridescent-v5-spiral-bloom",
    "iridescent",
    "2026-11-10"
  ),
  sketch(
    "sculpt-v1-scatter-lattice",
    "sculpt",
    "2026-09-21"
  ),
  sketch(
    "rings-v10-magnetic-flyby",
    "rings",
    "2026-08-14",
    {
      favorite: true,
      hasPreview: true
    }
  ),
  sketch(
    "rings-v9-flick-reveal",
    "rings",
    "2026-08-09",
    {
      favorite: true,
      hasPreview: true
    }
  ),
  sketch(
    "torsade-v0",
    "torsade",
    "2026-05-26",
    {
      favorite: true
    }
  ),
  sketch(
    "old-hidden",
    "misc",
    "2026-11-01",
    {
      hiddenFromGallery: true,
      favorite: true
    }
  ),
  sketch(
    "pulse-v1",
    "pulse",
    "2026-05-27"
  )
];

const slots = ( n: number ) => Array.from(
  {
    length: n
  },
  (
    _, i
  ) => new Date( NOW + ( i + 1 ) * 86_400_000 )
);

const plan = (
  choices: Partial<PlanChoices> = {}, posted: { sketchKey: string;
    at: number }[] = [], n = 6
) => planSlots( {
  catalogue: CATALOGUE,
  slots: slots( n ),
  posted,
  choices: {
    ...EMPTY_CHOICES,
    ...choices
  },
  now: NOW
} );

describe(
  "planner",
  () => {
    it(
      "reads a series' order from a name",
      () => {
        expect( versionOf( "churros-v9-pasta-scanner" ) ).toBe( 9 );
        expect( versionOf( "36days-of-type-2023-4" ) ).toBe( 4 );
        expect( versionOf( "torsade-v0" ) ).toBe( 0 );
        expect( versionOf( "neon-graffiti" ) ).toBe( 0 );
      }
    );

    it(
      "queues the new sketches: newest series first, each in its own order, in turn",
      () => {
        expect( dropPool(
          CATALOGUE,
          new Set(),
          NOW
        ).map( ( s ) => s.name ) ).toEqual( [
          "materials-v1-flame",
          "iridescent-v5-spiral-bloom",
          "sculpt-v1-scatter-lattice",
          "materials-v2-water"
        ] );
      }
    );

    it(
      "leaves out of the new sketches what was posted, what is hidden and what is old",
      () => {
        const names = dropPool(
          CATALOGUE,
          new Set( [
            "p5/materials-v1-flame"
          ] ),
          NOW
        ).map( ( s ) => s.name );

        expect( names ).not.toContain( "materials-v1-flame" );
        expect( names ).not.toContain( "old-hidden" );
        expect( names ).not.toContain( "pulse-v1" );
      }
    );

    it(
      "orders the favourites: never posted first, then the longest unseen",
      () => {
        const pool = favouritePool(
          CATALOGUE,
          new Map( [
            [
              "p5/torsade-v0",
              NOW - 30 * WEEK
            ],
            [
              "p5/rings-v9-flick-reveal",
              NOW - 10 * WEEK
            ]
          ] )
        ).map( ( s ) => s.name );

        expect( pool ).toEqual( [
          "rings-v10-magnetic-flyby",
          "torsade-v0",
          "rings-v9-flick-reveal"
        ] );
      }
    );

    it(
      "alternates the pillars by the mix and never proposes a sketch twice",
      () => {
        const out = plan();

        // The fifth slot asks for a series; this catalogue has none of three sketches, so a new sketch takes it.
        expect( out.map( ( s ) => s.proposal?.pillar ) ).toEqual( [
          "drop",
          "favourite",
          "drop",
          "favourite",
          "drop",
          "drop"
        ] );

        const keys = out.map( ( s ) => s.proposal?.sketchKey );

        expect( new Set( keys ).size ).toBe( keys.length );
        expect( plan( {
          mix: "favourites"
        } ).map( ( s ) => s.proposal?.pillar )
          .slice(
            0,
            3
          ) ).toEqual( [
          "favourite",
          "favourite",
          "drop"
        ] );
      }
    );

    it(
      "falls back on the other pillar when one runs out, then proposes nothing",
      () => {
        const out = plan(
          {},
          [],
          9
        );

        expect( out.filter( ( s ) => s.proposal ).length ).toBe( 7 );
        expect( out[ 7 ].proposal ).toBeNull();
        expect( out[ 8 ].proposal ).toBeNull();
        expect( out[ 8 ].skipped ).toBe( false );
      }
    );

    it(
      "keeps a sketch away from a send of its own, before or after",
      () => {
        expect( tooSoon(
          [
            {
              sketchKey: "p5/a",
              at: NOW - 3 * WEEK
            }
          ],
          "p5/a",
          NOW,
          8
        ) ).toBe( true );
        expect( tooSoon(
          [
            {
              sketchKey: "p5/a",
              at: NOW - 9 * WEEK
            }
          ],
          "p5/a",
          NOW,
          8
        ) ).toBe( false );

        const out = plan(
          {},
          [
            {
              sketchKey: "p5/rings-v10-magnetic-flyby",
              at: NOW - 2 * WEEK
            },
            {
              sketchKey: "p5/torsade-v0",
              at: NOW + 3 * WEEK
            }
          ]
        );
        const keys = out.map( ( s ) => s.proposal?.sketchKey );

        expect( keys ).not.toContain( "p5/rings-v10-magnetic-flyby" );
        expect( keys ).not.toContain( "p5/torsade-v0" );
      }
    );

    it(
      "passes a proposal over, leaves a skipped slot empty and keeps a pin",
      () => {
        const first = plan()[ 0 ];
        const passed = plan( {
          passed: {
            [ first.proposal!.key ]: NOW
          }
        } );

        expect( passed[ 0 ].proposal?.key ).not.toBe( first.proposal!.key );
        expect( passed.map( ( s ) => s.proposal?.key ) ).not.toContain( first.proposal!.key );

        const skipped = plan( {
          skipped: {
            [ first.slot ]: NOW
          }
        } );

        expect( skipped[ 0 ] ).toMatchObject( {
          proposal: null,
          skipped: true
        } );
        expect( skipped[ 1 ].proposal?.key ).toBe( first.proposal!.key );

        const third = plan()[ 2 ].slot;
        const pinned = plan( {
          pins: {
            [ third ]: {
              sketchKey: "p5/torsade-v0",
              by: "agent",
              note: "The twist that started the series."
            }
          }
        } );

        expect( pinned[ 2 ].proposal ).toMatchObject( {
          sketchKey: "p5/torsade-v0",
          pillar: "favourite",
          why: "The twist that started the series."
        } );
        expect( pinned.filter( ( s ) => s.proposal?.sketchKey === "p5/torsade-v0" ).length ).toBe( 1 );
      }
    );

    it(
      "says why, and never a number it did not read",
      () => {
        const out = plan(
          {},
          [
            {
              sketchKey: "p5/rings-v10-magnetic-flyby",
              at: NOW - 20 * WEEK
            }
          ],
          8
        );
        const drop = out.find( ( s ) => s.proposal?.sketchKey === "p5/materials-v1-flame" )!.proposal!;
        const favourite = out.find( ( s ) => s.proposal?.sketchKey === "p5/rings-v10-magnetic-flyby" )!.proposal!;

        expect( drop.title ).toBe( "Materials · Flame" );
        expect( drop.path ).toBe( "p5/materials/materials-v1-flame" );
        expect( drop.why ).toBe( "Made 10 Nov 2026 · 1st of 2 in its series · never posted from here · no description yet" );
        expect( favourite.why ).toContain( "last posted 3 Jul 2026" );
      }
    );
  }
);

describe(
  "plan choices",
  () => {
    it(
      "reads back anything, and drops what went stale",
      () => {
        const ahead = new Date( NOW + WEEK ).toISOString();
        const gone = new Date( NOW - WEEK ).toISOString();
        const read = readChoices(
          {
            mix: "nonsense",
            gapWeeks: 5,
            passed: {
              "drop:p5/a": NOW - 1000,
              "drop:p5/old": NOW - 70 * 86_400_000,
              "drop:p5/bad": "yesterday"
            },
            skipped: {
              [ ahead ]: NOW,
              [ gone ]: NOW
            },
            opened: {
              "series:p5/materials": NOW - 1000,
              "recap:2024": NOW - 400 * 86_400_000
            },
            pins: {
              [ ahead ]: {
                sketchKey: "p5/torsade-v0",
                by: "someone",
                note: "  hello  "
              },
              [ gone ]: {
                sketchKey: "p5/torsade-v0"
              },
              "not a date": {
                sketchKey: "p5/x"
              }
            }
          },
          NOW
        );

        expect( read.mix ).toBe( "balanced" );
        expect( read.gapWeeks ).toBe( 8 );
        expect( Object.keys( read.passed ) ).toEqual( [
          "drop:p5/a"
        ] );
        expect( Object.keys( read.skipped ) ).toEqual( [
          ahead
        ] );
        expect( read.opened ).toEqual( {
          "series:p5/materials": NOW - 1000
        } );
        expect( read.pins ).toEqual( {
          [ ahead ]: {
            sketchKey: "p5/torsade-v0",
            by: "person",
            note: "hello"
          }
        } );
        expect( readChoices(
          null,
          NOW
        ) ).toEqual( EMPTY_CHOICES );
      }
    );
  }
);

describe(
  "plan slots",
  () => {
    it(
      "lists the rhythm's free slots over the weeks, a taken one left out",
      () => {
        const now = new Date( NOW );
        const all = planFreeSlots(
          DEFAULT_RHYTHM,
          [],
          now,
          2
        );

        // Fri 20 Nov 13:00 Paris: Fri 19:00 and Sun 10:00 this week, three next week.
        expect( all.map( ( d ) => d.toISOString() ) ).toEqual( [
          "2026-11-20T18:00:00.000Z",
          "2026-11-22T09:00:00.000Z",
          "2026-11-24T08:00:00.000Z",
          "2026-11-27T18:00:00.000Z",
          "2026-11-29T09:00:00.000Z"
        ] );
        expect( planFreeSlots(
          DEFAULT_RHYTHM,
          [
            {
              publishDate: "2026-11-24T08:00:00.000Z",
              state: "QUEUE"
            }
          ],
          now,
          2
        ).length ).toBe( 4 );
      }
    );
  }
);

const SERIES: PlanSketch[] = [
  ...[
    1,
    2,
    3,
    4
  ].map( ( v ) => sketch(
    `materials-v${ v }-x`,
    "materials",
    `2026-11-${ String( 9 + v ).padStart(
      2,
      "0"
    ) }`
  ) ),
  ...Array.from(
    {
      length: 11
    },
    (
      _, i
    ) => sketch(
      `churros-v${ i + 1 }-x`,
      "churros",
      "2026-05-26",
      {
        favorite: i === 3
      }
    )
  ),
  sketch(
    "photo-a",
    "photo",
    "2026-11-01"
  ),
  sketch(
    "photo-b",
    "photo",
    "2026-11-02"
  ),
  sketch(
    "photo-c",
    "photo",
    "2026-11-03"
  ),
  sketch(
    "slow-v1",
    "slow",
    "2026-11-04",
    {
      asyncDraw: true
    }
  ),
  sketch(
    "rings-v1-a",
    "rings",
    "2026-07-11",
    {
      favorite: true
    }
  )
];

describe(
  "series and recaps",
  () => {
    it(
      "samples a long reel evenly, the first and the last kept",
      () => {
        expect( sampleReel( [
          1,
          2,
          3
        ] ) ).toEqual( [
          1,
          2,
          3
        ] );

        const eleven = sampleReel( Array.from(
          {
            length: 11
          },
          (
            _, i
          ) => i + 1
        ) );

        expect( eleven.length ).toBe( 8 );
        expect( eleven[ 0 ] ).toBe( 1 );
        expect( eleven[ 7 ] ).toBe( 11 );
        expect( new Set( eleven ).size ).toBe( 8 );
      }
    );

    it(
      "offers a series of three playable sketches or more, the one touched last first",
      () => {
        const pool = seriesPool( SERIES );

        expect( pool.map( ( p ) => p.key ) ).toEqual( [
          "series:p5/materials",
          "series:p5/churros"
        ] );
        expect( pool[ 0 ] ).toMatchObject( {
          pillar: "series",
          title: "Materials · the series",
          path: "p5/empty-sketch",
          sketchKey: "p5/empty-sketch"
        } );
        expect( pool[ 0 ].reel ).toEqual( {
          title: "MATERIALS",
          subtitle: "4 SKETCHES",
          sketches: [
            "p5/materials-v1-x",
            "p5/materials-v2-x",
            "p5/materials-v3-x",
            "p5/materials-v4-x"
          ],
          scenes: [
            "materials/materials-v1-x",
            "materials/materials-v2-x",
            "materials/materials-v3-x",
            "materials/materials-v4-x"
          ]
        } );
        expect( pool[ 1 ].reel!.sketches.length ).toBe( 8 );
        expect( pool[ 1 ].why ).toContain( "11 sketches in one Reel, 8 of them shown" );
      }
    );

    it(
      "recaps a month from what was posted in it, else from what was made in it, else not at all",
      () => {
        const made = monthRecap(
          SERIES,
          [],
          "2026-11",
          "Europe/Paris"
        )!;

        expect( made.key ).toBe( "recap:2026-11" );
        expect( made.title ).toBe( "November in sketches" );
        expect( made.reel!.sketches ).toEqual( [
          "p5/materials-v1-x",
          "p5/materials-v2-x",
          "p5/materials-v3-x",
          "p5/materials-v4-x"
        ] );
        expect( made.why ).toContain( "4 sketches made in November" );

        const sent = monthRecap(
          SERIES,
          [
            {
              sketchKey: "p5/churros-v2-x",
              at: Date.parse( "2026-11-12T09:00:00Z" )
            },
            {
              sketchKey: "p5/rings-v1-a",
              at: Date.parse( "2026-11-03T09:00:00Z" )
            },
            {
              sketchKey: "p5/churros-v1-x",
              at: Date.parse( "2026-11-08T09:00:00Z" )
            },
            {
              sketchKey: "p5/churros-v1-x",
              at: Date.parse( "2026-11-18T09:00:00Z" )
            }
          ],
          "2026-11",
          "Europe/Paris"
        )!;

        expect( sent.reel!.sketches ).toEqual( [
          "p5/rings-v1-a",
          "p5/churros-v1-x",
          "p5/churros-v2-x"
        ] );
        expect( sent.why ).toContain( "3 sketches posted in November" );
        expect( monthRecap(
          SERIES,
          [],
          "2026-10",
          "Europe/Paris"
        ) ).toBeNull();
      }
    );

    it(
      "recaps the year with one sketch a month, a favourite first",
      () => {
        const year = yearRecap(
          SERIES,
          "2026"
        )!;

        expect( year.key ).toBe( "recap:2026" );
        expect( year.reel!.sketches ).toEqual( [
          "p5/churros-v4-x",
          "p5/rings-v1-a",
          "p5/materials-v4-x"
        ] );
        expect( yearRecap(
          SERIES,
          "2025"
        ) ).toBeNull();
      }
    );

    it(
      "puts the month's recap on the first slot of the next month and the year's on December's last",
      () => {
        const at = ( day: string ) => new Date( `${ day }T09:00:00Z` );
        const dates = rendezvous(
          [
            at( "2026-11-24" ),
            at( "2026-11-29" ),
            at( "2026-12-01" ),
            at( "2026-12-04" ),
            at( "2026-12-18" ),
            at( "2026-12-20" )
          ],
          SERIES,
          [],
          "Europe/Paris"
        );

        expect( [
          ...dates.entries()
        ].map( ( [
          slot,
          p
        ] ) => `${ slot.slice(
          0,
          10
        ) } ${ p.key }` ) ).toEqual( [
          "2026-12-01 recap:2026-11",
          "2026-12-20 recap:2026"
        ] );
        // A plan that opens mid-December did not see the month begin: no stale recap of November.
        expect( rendezvous(
          [
            at( "2026-12-22" ),
            at( "2026-12-25" )
          ],
          SERIES,
          [],
          "Europe/Paris"
        ).size ).toBe( 1 );
      }
    );

    it(
      "lays series and recaps into the plan, and lets them be passed over or wait once opened",
      () => {
        const at = ( day: string ) => new Date( `${ day }T09:00:00Z` );
        const days = [
          "2026-11-22",
          "2026-11-24",
          "2026-11-27",
          "2026-11-29",
          "2026-12-01",
          "2026-12-04",
          "2026-12-06"
        ].map( at );
        const run = ( choices: Partial<PlanChoices> = {} ) => planSlots( {
          catalogue: SERIES,
          slots: days,
          posted: [],
          choices: {
            ...EMPTY_CHOICES,
            ...choices
          },
          now: NOW,
          timeZone: "Europe/Paris"
        } ).map( ( s ) => s.proposal?.key );

        const plain = run();

        expect( plain[ 4 ] ).toBe( "recap:2026-11" );
        // The fifth slot the PATTERN fills (the recap's slot is not one) is the series'.
        expect( plain[ 5 ] ).toBe( "series:p5/materials" );
        expect( run( {
          passed: {
            "recap:2026-11": NOW
          }
        } )[ 4 ] ).toBe( "series:p5/materials" );
        expect( run( {
          opened: {
            "series:p5/materials": NOW - 86_400_000
          }
        } )[ 5 ] ).toBe( "series:p5/churros" );
      }
    );

    it(
      "builds a reel the app itself accepts: an opening card, then each sketch",
      () => {
        const proposal = seriesPool( SERIES )[ 0 ];
        const document = reelDocument( proposal )!;
        const parsed = parseImportedOptions( document );

        expect( parsed.ok ).toBe( true );
        if ( !parsed.ok ) {
          return;
        }

        expect( parsed.options.name ).toBe( "empty-sketch" );
        expect( parsed.options.animation.duration ).toBe( reelSeconds( 4 ) );
        expect( reelSeconds( 4 ) ).toBe( 12 );
        expect( reelSeconds( 40 ) ).toBe( 60 );

        const item = parsed.options.content[ 0 ] as { type: string;
          scenes: { kind: string;
            sketch?: string;
            title?: string }[]; };

        expect( item.type ).toBe( "sequence" );
        expect( item.scenes.map( ( scene ) => scene.kind ) ).toEqual( [
          "splash",
          "sketch",
          "sketch",
          "sketch",
          "sketch"
        ] );
        expect( item.scenes[ 0 ].title ).toBe( "MATERIALS" );
        expect( item.scenes[ 1 ].sketch ).toBe( "materials/materials-v1-x" );
        expect( reelCaption( proposal ) ).toContain( "Materials · the series" );
        expect( reelCaption( proposal ) ).not.toContain( "{link}" );
        expect( reelDocument( {} ) ).toBeNull();
      }
    );
  }
);
