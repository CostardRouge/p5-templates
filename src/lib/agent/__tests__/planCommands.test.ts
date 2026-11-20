/**
 * plan.*: the gallery's Plan read and steered from the tab — proposing only.
 */
import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  planCommands
} from "../commands/planCommands";
import {
  navigationCommands
} from "../commands/navigationCommands";
import {
  clearPlanStore, getChoices
} from "../../planner/planStore";
import {
  postedFrom
} from "../../planner/posted";
import {
  DEFAULT_RHYTHM
} from "../../postiz/rhythm";
import {
  fakeHandles
} from "./fakeHandles";

const day = ( offset: number ) => new Date( Date.now() + offset * 86_400_000 ).toISOString()
  .slice(
    0,
    10
  );

const CATALOGUE = [
  {
    engine: "p5",
    category: "materials",
    name: "materials-v1-flame",
    createdAt: day( -10 )
  },
  {
    engine: "p5",
    category: "materials",
    name: "materials-v2-water",
    createdAt: day( -9 )
  },
  {
    engine: "p5",
    category: "rings",
    name: "rings-v10-magnetic-flyby",
    createdAt: day( -200 ),
    favorite: true
  },
  {
    engine: "p5",
    category: "torsade",
    name: "torsade-v0",
    createdAt: day( -300 ),
    favorite: true
  }
];

const RINGS = [
  {
    engine: "p5",
    category: "rings",
    name: "rings-v1-a",
    createdAt: day( -6 ),
    favorite: true
  },
  {
    engine: "p5",
    category: "rings",
    name: "rings-v2-b",
    createdAt: day( -5 )
  },
  {
    engine: "p5",
    category: "rings",
    name: "rings-v3-c",
    createdAt: day( -4 ),
    favorite: true
  },
  {
    engine: "p5",
    category: "photo",
    name: "photo-a",
    createdAt: day( -300 )
  }
];

interface Plan {
  slots: { at: string;
    state: string;
    sketch?: string;
    pillar?: string;
    why?: string }[];
  mix: string;
  gapWeeks: number;
  note: string;
}

function setup() {
  const fake = fakeHandles( {} );

  fake.handles.navigation.catalogue = () => CATALOGUE;
  clearPlanStore();

  const registry = createCommandRegistry();

  registry.register( [
    ...planCommands( fake.handles ),
    ...navigationCommands( fake.handles )
  ] );

  return {
    ...fake,
    registry,
    get: async() => await registry.execute(
      "plan.get",
      {}
    ) as Plan
  };
}

describe(
  "plan commands",
  () => {
    it(
      "read the plan on the default rhythm when no Postiz is kept, and say so",
      async() => {
        const {
          get
        } = setup();
        const plan = await get();

        expect( plan.slots.length ).toBeGreaterThanOrEqual( 12 );
        expect( plan.slots.slice(
          0,
          4
        ).map( ( s ) => s.sketch ) ).toEqual( [
          "p5/materials/materials-v1-flame",
          expect.stringMatching( /^p5\/(rings|torsade)\// ),
          "p5/materials/materials-v2-water",
          expect.stringMatching( /^p5\/(rings|torsade)\// )
        ] );
        expect( plan.slots[ 4 ].state ).toBe( "nothing left" );
        expect( plan.note ).toContain( "No Postiz is connected" );
      }
    );

    it(
      "pin a sketch with its why, refuse what cannot be, and pass over or skip",
      async() => {
        const {
          registry, get
        } = setup();
        const before = await get();
        const third = before.slots[ 2 ].at;

        await expect( registry.execute(
          "plan.propose",
          {
            at: "2020-01-01T00:00:00Z",
            sketch: "p5/torsade/torsade-v0"
          }
        ) ).rejects.toThrow( /not a free slot/ );
        await expect( registry.execute(
          "plan.propose",
          {
            at: third,
            sketch: "p5/nope/nope"
          }
        ) ).rejects.toThrow( /no sketch/ );

        const pinned = await registry.execute(
          "plan.propose",
          {
            at: third,
            sketch: "p5/torsade/torsade-v0",
            note: "The twist that started it."
          }
        ) as Plan;

        expect( pinned.slots[ 2 ] ).toMatchObject( {
          sketch: "p5/torsade/torsade-v0",
          state: "pinned by an agent",
          why: "The twist that started it."
        } );
        expect( pinned.slots.filter( ( s ) => s.sketch === "p5/torsade/torsade-v0" ).length ).toBe( 1 );
        await expect( registry.execute(
          "plan.propose",
          {
            at: before.slots[ 0 ].at,
            sketch: "p5/torsade/torsade-v0"
          }
        ) ).rejects.toThrow( /already pinned/ );

        const passed = await registry.execute(
          "plan.another",
          {
            at: before.slots[ 0 ].at
          }
        ) as Plan;

        expect( passed.slots.map( ( s ) => s.sketch ) ).not.toContain( "p5/materials/materials-v1-flame" );

        const skipped = await registry.execute(
          "plan.skip",
          {
            at: before.slots[ 1 ].at
          }
        ) as Plan;

        expect( skipped.slots[ 1 ].state ).toBe( "skipped" );
        expect( Object.keys( getChoices().pins ) ).toEqual( [
          third
        ] );

        const reset = await registry.execute(
          "plan.reset",
          {}
        ) as Plan;

        expect( reset.slots[ 0 ].sketch ).toBe( "p5/materials/materials-v1-flame" );
      }
    );

    it(
      "change the rules, refusing a gap that is not offered",
      async() => {
        const {
          registry
        } = setup();

        await expect( registry.execute(
          "plan.set",
          {
            gapWeeks: 5
          }
        ) ).rejects.toThrow( /not offered/ );
        expect( await registry.execute(
          "plan.set",
          {
            mix: "favourites",
            gapWeeks: 12
          }
        ) ).toMatchObject( {
          mix: "favourites",
          gapWeeks: 12
        } );
      }
    );

    it(
      "build a series' reel on the empty sketch when its proposal is opened",
      async() => {
        const fake = fakeHandles( {} );
        const staged: unknown[] = [];
        const opened: string[] = [];

        fake.handles.navigation.catalogue = () => [
          ...CATALOGUE,
          {
            engine: "p5",
            category: "materials",
            name: "materials-v3-caustics",
            createdAt: day( -8 )
          }
        ];
        fake.handles.publish.connection = () => ( {
          rhythm: DEFAULT_RHYTHM
        } ) as ReturnType<typeof fake.handles.publish.connection>;
        fake.handles.gallery.stageImport = ( options ) => {
          staged.push( options );

          return true;
        };
        fake.handles.navigation.open = ( href ) => {
          opened.push( href );
        };
        fake.handles.navigation.currentSketch = () => opened.length ? "p5/empty-sketch" : "p5/voronoi/voronoi-v1-cells";
        clearPlanStore();

        const registry = createCommandRegistry();

        registry.register( planCommands( fake.handles ) );

        const plan = await registry.execute(
          "plan.get",
          {}
        ) as Plan & { slots: { reel?: string[];
          seconds?: number;
          key?: string }[]; };
        const series = plan.slots.find( ( s ) => s.pillar === "series" )!;

        expect( series ).toMatchObject( {
          sketch: "p5/empty-sketch",
          key: "series:p5/materials",
          reel: [
            "p5/materials/materials-v1-flame",
            "p5/materials/materials-v2-water",
            "p5/materials/materials-v3-caustics"
          ],
          seconds: 9
        } );
        expect( await registry.execute(
          "plan.open",
          {
            at: series.at,
            discard: true
          }
        ) ).toMatchObject( {
          sketch: "p5/empty-sketch",
          opened: true
        } );
        expect( opened ).toEqual( [
          "/sketches/p5/empty-sketch"
        ] );
        expect( staged[ 0 ] ).toMatchObject( {
          name: "empty-sketch",
          content: [
            {
              type: "sequence"
            }
          ]
        } );
        // Opened, so it waits for the gap: the next plan proposes no series (there is only this one).
        expect( getChoices().opened[ "series:p5/materials" ] ).toBeGreaterThan( 0 );
        expect( ( await registry.execute(
          "plan.get",
          {}
        ) as Plan ).slots.some( ( s ) => s.pillar === "series" ) ).toBe( false );
      }
    );

    it(
      "pin a reel made on purpose, or a recap, and refuse what cannot play",
      async() => {
        const fake = fakeHandles( {} );

        fake.handles.navigation.catalogue = () => RINGS;
        clearPlanStore();

        const registry = createCommandRegistry();

        registry.register( planCommands( fake.handles ) );

        const plan = await registry.execute(
          "plan.get",
          {}
        ) as Plan;
        const at = plan.slots[ 0 ].at;

        await expect( registry.execute(
          "plan.propose",
          {
            at
          }
        ) ).rejects.toThrow( /exactly one/ );
        await expect( registry.execute(
          "plan.propose",
          {
            at,
            sketches: [
              "p5/rings/rings-v1-a",
              "p5/photo/photo-a"
            ]
          }
        ) ).rejects.toThrow( /cannot be a scene/ );
        await expect( registry.execute(
          "plan.propose",
          {
            at,
            recap: "2019-03"
          }
        ) ).rejects.toThrow( /nothing to recap/ );

        const pinned = await registry.execute(
          "plan.propose",
          {
            at,
            sketches: [
              "p5/rings/rings-v3-c",
              "p5/rings/rings-v1-a"
            ],
            note: "Your two favourite rings, back to back."
          }
        ) as Plan & { slots: { reel?: string[];
          title?: string }[]; };

        expect( pinned.slots[ 0 ] ).toMatchObject( {
          state: "pinned by an agent",
          pillar: "series",
          title: "Rings",
          sketch: "p5/empty-sketch",
          reel: [
            "p5/rings/rings-v3-c",
            "p5/rings/rings-v1-a"
          ],
          why: "Your two favourite rings, back to back."
        } );

        const recap = await registry.execute(
          "plan.propose",
          {
            at: plan.slots[ 1 ].at,
            recap: day( -5 ).slice(
              0,
              7
            ),
            title: "This month"
          }
        ) as typeof pinned;

        expect( recap.slots[ 1 ] ).toMatchObject( {
          pillar: "recap",
          title: "This month"
        } );
        expect( recap.slots[ 1 ].reel!.length ).toBe( 3 );
      }
    );

    it(
      "build a reel of a series' favourites at once, and list what was posted",
      async() => {
        const fake = fakeHandles( {} );
        const staged: unknown[] = [];
        const opened: string[] = [];

        fake.handles.navigation.catalogue = () => RINGS;
        fake.handles.gallery.stageImport = ( options ) => {
          staged.push( options );

          return true;
        };
        fake.handles.navigation.open = ( href ) => {
          opened.push( href );
        };
        fake.handles.navigation.currentSketch = () => opened.length ? "p5/empty-sketch" : "p5/voronoi/voronoi-v1-cells";
        clearPlanStore();

        const registry = createCommandRegistry();

        registry.register( planCommands( fake.handles ) );

        await expect( registry.execute(
          "reel.build",
          {}
        ) ).rejects.toThrow( /sketches, or a category/ );
        await expect( registry.execute(
          "reel.build",
          {
            category: "nope"
          }
        ) ).rejects.toThrow( /no series/ );

        expect( await registry.execute(
          "reel.build",
          {
            category: "rings",
            favorite: true,
            discard: true
          }
        ) ).toMatchObject( {
          sketch: "p5/empty-sketch",
          title: "Rings",
          reel: [
            "p5/rings/rings-v1-a",
            "p5/rings/rings-v3-c"
          ],
          seconds: 7,
          opened: true
        } );
        expect( staged[ 0 ] ).toMatchObject( {
          name: "empty-sketch"
        } );
        expect( await registry.execute(
          "plan.posted",
          {}
        ) ).toMatchObject( {
          posts: []
        } );
        await expect( registry.execute(
          "plan.posted",
          {
            month: "november"
          }
        ) ).rejects.toThrow( /not a month/ );
      }
    );

    it(
      "have no way to approve or send, and open only with a Postiz",
      async() => {
        const {
          registry
        } = setup();
        const listed = await registry.list();
        const ids = listed.map( ( c ) => c.id );

        expect( ids.filter( ( id ) => id.startsWith( "plan." ) ).sort() ).toEqual( [
          "plan.another",
          "plan.get",
          "plan.open",
          "plan.posted",
          "plan.propose",
          "plan.reset",
          "plan.set",
          "plan.skip"
        ] );
        expect( listed.find( ( c ) => c.id === "plan.open" ) ).toMatchObject( {
          available: false
        } );
      }
    );

    it(
      "list only the favourites on request",
      async() => {
        const {
          registry
        } = setup();
        const out = await registry.execute(
          "sketches.list",
          {
            favorite: true
          }
        ) as { sketches: { id: string;
          favorite?: boolean }[]; };

        expect( out.sketches.map( ( s ) => s.id ) ).toEqual( [
          "p5/rings/rings-v10-magnetic-flyby",
          "p5/torsade/torsade-v0"
        ] );
        expect( out.sketches[ 0 ].favorite ).toBe( true );
      }
    );
  }
);

describe(
  "postedFrom",
  () => {
    it(
      "counts kept sends and linked posts, never a draft nor a failure",
      () => {
        expect( postedFrom(
          [
            {
              key: "p5/a",
              publication: {
                at: "2026-11-15T09:00:00.000Z",
                target: "schedule",
                sentAt: 1
              }
            },
            {
              key: "p5/b",
              publication: {
                at: null,
                target: "draft",
                sentAt: 2
              }
            },
            {
              key: "p5/c",
              publication: {
                at: null,
                target: "now",
                sentAt: 3
              }
            }
          ],
          [
            {
              content: "Sand https://p5.steeve.website/sketches/p5/materials/materials-v4-sand",
              publishDate: "2026-11-12T09:00:00.000Z",
              state: "published"
            },
            {
              content: "Ice https://p5.steeve.website/sketches/p5/materials/materials-v5-ice",
              publishDate: "2026-11-13T09:00:00.000Z",
              state: "error"
            },
            {
              content: "no link",
              publishDate: "2026-11-13T09:00:00.000Z",
              state: "published"
            }
          ]
        ) ).toEqual( [
          {
            sketchKey: "p5/a",
            at: Date.parse( "2026-11-15T09:00:00.000Z" )
          },
          {
            sketchKey: "p5/c",
            at: 3
          },
          {
            sketchKey: "p5/materials-v4-sand",
            at: Date.parse( "2026-11-12T09:00:00.000Z" )
          }
        ] );
      }
    );
  }
);
