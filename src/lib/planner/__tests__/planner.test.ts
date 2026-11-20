import {
  dropPool, EMPTY_CHOICES, favouritePool, planSlots, tooSoon, versionOf, type PlanChoices, type PlanSketch
} from "../planner";
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
  ) => new Date( NOW + ( i + 1 ) * 2 * 86_400_000 )
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

        expect( out.map( ( s ) => s.proposal?.pillar ) ).toEqual( [
          "drop",
          "favourite",
          "drop",
          "favourite",
          "drop",
          "favourite"
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
          ]
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
