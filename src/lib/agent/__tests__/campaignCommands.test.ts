/**
 * campaign.* and variations.*: a campaign proposed from the tab, variations
 * proposed, looked at and kept as candidates — never accepted, never sent.
 */
import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  campaignCommands
} from "../commands/campaignCommands";
import {
  planCommands
} from "../commands/planCommands";
import {
  variationCommands
} from "../commands/variationCommands";
import {
  clearCampaignStore, getCampaigns
} from "../../planner/campaignStore";
import {
  clearPlanStore, getChoices
} from "../../planner/planStore";
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
    category: "voronoi",
    name: "voronoi-v1-cells",
    createdAt: day( -3 )
  },
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
    category: "materials",
    name: "materials-v3-smoke",
    createdAt: day( -8 )
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
    name: "empty-sketch",
    hiddenFromGallery: true
  }
];

interface PlanAnswer {
  slots: { at: string;
    state: string;
    sketch?: string;
    title?: string;
    pillar?: string;
    campaign?: { id: string;
      beat: string;
      of: string;
      waitsFor?: string; }; }[];
}

interface CampaignAnswer {
  id: string;
  sketch: string;
  template: string;
  by: string;
  kept: boolean;
  beats: { beat: string;
    state: string;
    at?: string;
    waitsFor?: string; }[];
  leftOut: { beat: string;
    why: string }[];
}

function setup( document: Record<string, unknown> = {} ) {
  const fake = fakeHandles( {
    sketch: {
      render: {
        hueSpeed: 0,
        palette: "rainbow"
      }
    },
    ...document
  } );
  const opened: string[] = [];
  const staged: unknown[] = [];

  fake.handles.navigation.catalogue = () => CATALOGUE;
  fake.handles.navigation.open = ( href ) => {
    opened.push( href );
  };
  fake.handles.navigation.currentSketch = () => opened.length ? opened[ opened.length - 1 ].replace(
    "/sketches/",
    ""
  ) : "p5/voronoi/voronoi-v1-cells";
  fake.handles.gallery.stageImport = ( options ) => {
    staged.push( options );

    return true;
  };
  fake.handles.publish.connection = () => ( {
    rhythm: DEFAULT_RHYTHM
  } ) as ReturnType<typeof fake.handles.publish.connection>;
  clearPlanStore();
  clearCampaignStore();

  const registry = createCommandRegistry();

  registry.register( [
    ...planCommands( fake.handles ),
    ...campaignCommands( fake.handles ),
    ...variationCommands( fake.handles )
  ] );

  return {
    ...fake,
    registry,
    opened,
    staged,
    plan: async() => await registry.execute(
      "plan.get",
      {}
    ) as PlanAnswer
  };
}

/** The slot where the plan proposes `sketch`. */
async function slotOf(
  plan: () => Promise<PlanAnswer>, sketch: string
) {
  return ( await plan() ).slots.find( ( s ) => s.sketch === sketch )!.at;
}

describe(
  "campaign commands",
  () => {
    it(
      "preview a campaign without keeping it, then create it as lines of the plan",
      async() => {
        const {
          registry, plan
        } = setup();
        const at = await slotOf(
          plan,
          "p5/materials/materials-v3-smoke"
        );
        const preview = await registry.execute(
          "campaign.preview",
          {
            at
          }
        ) as CampaignAnswer & { offered: string[] };

        expect( preview.kept ).toBe( false );
        expect( preview.template ).toBe( "drop" );
        expect( preview.offered ).toEqual( [
          "drop",
          "finale"
        ] );
        expect( preview.beats.map( ( b ) => b.beat ) ).toEqual( [
          "release",
          "variations",
          "process",
          "comeback"
        ] );
        expect( preview.beats[ 0 ].at ).toBe( at );
        expect( preview.beats[ 1 ].waitsFor ).toBe( "3 accepted variations — 0 so far" );
        expect( getCampaigns() ).toEqual( [] );

        const created = await registry.execute(
          "campaign.create",
          {
            at,
            without: [
              "comeback"
            ]
          }
        ) as CampaignAnswer;

        expect( created ).toMatchObject( {
          kept: true,
          by: "an agent",
          leftOut: [
            {
              beat: "comeback",
              why: "left out on request"
            }
          ]
        } );
        expect( getCampaigns() ).toHaveLength( 1 );
        expect( getCampaigns()[ 0 ].by ).toBe( "agent" );

        const beats = ( await plan() ).slots.filter( ( s ) => s.campaign );

        expect( beats.map( ( s ) => [
          s.campaign!.beat,
          s.campaign!.of,
          s.state
        ] ) ).toEqual( [
          [
            "release",
            "1/3",
            "a campaign's beat"
          ],
          [
            "variations",
            "2/3",
            "a campaign's beat"
          ],
          [
            "process",
            "3/3",
            "a campaign's beat"
          ]
        ] );
        expect( beats[ 0 ].at ).toBe( at );
        expect( beats[ 0 ].title ).toBe( "Materials · Smoke · Release" );
      }
    );

    it(
      "refuse what a campaign cannot be",
      async() => {
        const {
          registry, plan
        } = setup();
        const at = await slotOf(
          plan,
          "p5/materials/materials-v3-smoke"
        );

        await expect( registry.execute(
          "campaign.create",
          {
            at,
            template: "comeback"
          }
        ) ).rejects.toThrow( /not offered.*drop, finale/ );
        await expect( registry.execute(
          "campaign.create",
          {
            at,
            without: [
              "nonsense"
            ]
          }
        ) ).rejects.toThrow( /no beat "nonsense"/ );
        await expect( registry.execute(
          "campaign.create",
          {
            at,
            sketch: "p5/nope"
          }
        ) ).rejects.toThrow( /no sketch/ );
        await expect( registry.execute(
          "campaign.create",
          {
            at: "2020-01-01T00:00:00Z"
          }
        ) ).rejects.toThrow( /not a free slot/ );

        await registry.execute(
          "campaign.create",
          {
            at
          }
        );

        const next = ( await plan() ).slots.find( ( s ) => !s.campaign && s.sketch )!.at;

        await expect( registry.execute(
          "campaign.create",
          {
            at: next,
            sketch: "p5/materials/materials-v3-smoke"
          }
        ) ).rejects.toThrow( /already has a campaign running/ );
        await expect( registry.execute(
          "campaign.create",
          {
            at
          }
        ) ).rejects.toThrow( /already holds a campaign's beat/ );
        await expect( registry.execute(
          "campaign.drop",
          {
            id: "nope"
          }
        ) ).rejects.toThrow( /no campaign/ );
      }
    );

    it(
      "leave a beat out through plan.another, put it back, and drop the campaign",
      async() => {
        const {
          registry, plan
        } = setup();
        const at = await slotOf(
          plan,
          "p5/materials/materials-v3-smoke"
        );
        const {
          id
        } = await registry.execute(
          "campaign.create",
          {
            at
          }
        ) as CampaignAnswer;
        const process = ( await plan() ).slots.find( ( s ) => s.campaign?.beat === "process" )!;

        await registry.execute(
          "plan.another",
          {
            at: process.at
          }
        );
        expect( getCampaigns()[ 0 ].off ).toEqual( [
          "process"
        ] );
        // Left out of the campaign — not passed over as a proposal of the plan.
        expect( Object.keys( getChoices().passed ) ).toEqual( [] );
        expect( ( await plan() ).slots.some( ( s ) => s.campaign?.beat === "process" ) ).toBe( false );

        await registry.execute(
          "campaign.beat",
          {
            id,
            beat: "process",
            on: true
          }
        );
        expect( ( await plan() ).slots.some( ( s ) => s.campaign?.beat === "process" ) ).toBe( true );

        const all = await registry.execute(
          "campaign.get",
          {}
        ) as { campaigns: CampaignAnswer[] };

        expect( all.campaigns ).toHaveLength( 1 );
        expect( all.campaigns[ 0 ].beats.map( ( b ) => b.state ) ).toEqual( [
          "proposed",
          "proposed",
          "proposed",
          "proposed"
        ] );

        expect( await registry.execute(
          "campaign.drop",
          {
            id
          }
        ) ).toMatchObject( {
          dropped: true,
          remaining: 0
        } );
        expect( ( await plan() ).slots.some( ( s ) => s.campaign ) ).toBe( false );
      }
    );

    it(
      "never approve nor send: no such command exists",
      async() => {
        const {
          registry
        } = setup();
        const ids = ( await registry.list() ).map( ( c ) => c.id );

        expect( ids.filter( ( id ) => /^(campaign|variations|process)\./.test( id ) ).sort() ).toEqual( [
          "campaign.beat",
          "campaign.create",
          "campaign.drop",
          "campaign.get",
          "campaign.preview",
          "process.build",
          "variations.build",
          "variations.keep",
          "variations.list",
          "variations.propose",
          "variations.sheet"
        ] );
        expect( ids.some( ( id ) => /approve|accept|schedule|send/.test( id ) ) ).toBe( false );
      }
    );

    it(
      "open the how-it's-made beat with the breakdown asked of the sketch page, and mark it opened",
      async() => {
        const {
          registry, plan, opened
        } = setup();
        const at = await slotOf(
          plan,
          "p5/materials/materials-v3-smoke"
        );

        await registry.execute(
          "campaign.create",
          {
            at
          }
        );

        const variations = ( await plan() ).slots.find( ( s ) => s.campaign?.beat === "variations" )!;

        await expect( registry.execute(
          "plan.open",
          {
            at: variations.at,
            discard: true
          }
        ) ).rejects.toThrow( /cannot be opened yet.*3 accepted variations — 0 so far/ );

        const process = ( await plan() ).slots.find( ( s ) => s.campaign?.beat === "process" )!;

        expect( await registry.execute(
          "plan.open",
          {
            at: process.at,
            discard: true
          }
        ) ).toMatchObject( {
          sketch: "p5/materials/materials-v3-smoke",
          opened: true
        } );
        expect( opened ).toEqual( [
          "/sketches/p5/materials/materials-v3-smoke"
        ] );
        expect( getCampaigns()[ 0 ].opened.process.slot ).toBe( process.at );
        // Opened is not posted: the beat is still proposed.
        expect( ( await plan() ).slots.some( ( s ) => s.campaign?.beat === "process" ) ).toBe( true );
      }
    );

    it(
      "stage the breakdown on the open sketch, once",
      async() => {
        const {
          registry, handles
        } = setup( {
          content: [
            {
              type: "text"
            }
          ]
        } );

        expect( await registry.execute(
          "process.build",
          {}
        ) ).toMatchObject( {
          path: "content.1"
        } );
        expect( handles.getValues( "content.1" ) ).toMatchObject( {
          type: "breakdown",
          build: {
            selection: "all"
          },
          placement: "roaming",
          size: 24
        } );
        await expect( registry.execute(
          "process.build",
          {}
        ) ).rejects.toThrow( /already plays a breakdown/ );
      }
    );
  }
);

describe(
  "variation commands",
  () => {
    interface Proposed {
      candidates: { candidate: string;
        move: string;
        label: string;
        values: Record<string, unknown>; }[];
      available: Record<string, number>;
    }

    it(
      "propose named moves from the sketch's own form, writing nothing",
      async() => {
        const {
          registry, writes
        } = setup();
        const out = await registry.execute(
          "variations.propose",
          {}
        ) as Proposed;

        expect( out.candidates.map( ( c ) => c.candidate ) ).toEqual( [
          "palette:render.palette=sunset",
          "high:render.hueSpeed",
          "low:render.hueSpeed"
        ] );
        expect( out.candidates[ 0 ] ).toMatchObject( {
          move: "palette",
          values: {
            render: {
              palette: "sunset"
            }
          }
        } );
        expect( out.available ).toMatchObject( {
          palette: 1,
          amount: 2
        } );
        expect( writes ).toEqual( [] );
      }
    );

    it(
      "show the candidates in one picture and put the form back",
      async() => {
        const {
          registry, calls, handles
        } = setup();
        const sheet = await registry.execute(
          "variations.sheet",
          {}
        ) as { kind: string;
          note: string };

        expect( sheet.kind ).toBe( "image" );
        expect( calls.find( ( call ) => call.startsWith( "sheet " ) ) ).toBe( "sheet 0 · as it is|1 · Palette: sunset|2 · Hue speed 0 → 2.4|3 · Hue speed 0 → 0.6" );
        expect( sheet.note ).toMatch( /1 = palette:render\.palette=sunset/ );
        expect( handles.getValues( "sketch.render" ) ).toEqual( {
          hueSpeed: 0,
          palette: "rainbow"
        } );
        // Paused for the look, then back to playing where it was.
        expect( calls.filter( ( call ) => call === "pause" || call === "play" ) ).toEqual( [
          "pause",
          "play"
        ] );
        await expect( registry.execute(
          "variations.sheet",
          {
            candidates: [
              "palette:render.palette=nope"
            ]
          }
        ) ).rejects.toThrow( /no candidate/ );
      }
    );

    it(
      "keep a variation as a candidate — the applied document, the form put back — and never accept it",
      async() => {
        const {
          registry, handles
        } = setup();
        const kept = await registry.execute(
          "variations.keep",
          {
            candidate: "palette:render.palette=sunset"
          }
        ) as { id: string;
          state: string;
          kept: boolean;
          label: string };

        expect( kept ).toMatchObject( {
          state: "candidate",
          kept: true,
          label: "Palette: sunset"
        } );

        const entry = ( await handles.gallery.store.get( kept.id ) )!;

        expect( entry.variation ).toEqual( {
          state: "candidate",
          by: "agent",
          label: "Palette: sunset"
        } );
        expect( ( entry.options.sketch as { render: { palette: string } } ).render.palette ).toBe( "sunset" );
        expect( handles.getValues( "sketch.render.palette" ) ).toBe( "rainbow" );

        const own = await registry.execute(
          "variations.keep",
          {
            values: {
              render: {
                hueSpeed: 1.5
              }
            },
            label: "Slow hue drift"
          }
        ) as { id: string };

        expect( ( await handles.gallery.store.get( own.id ) )!.variation!.label ).toBe( "Slow hue drift" );
        await expect( registry.execute(
          "variations.keep",
          {
            values: {
              render: {
                hueSpeed: 9
              }
            }
          }
        ) ).rejects.toThrow( /above its maximum 3/ );
        await expect( registry.execute(
          "variations.keep",
          {}
        ) ).rejects.toThrow( /one of candidate or values/ );

        const list = await registry.execute(
          "variations.list",
          {}
        ) as { accepted: number;
          candidates: number;
          note: string };

        expect( list ).toMatchObject( {
          accepted: 0,
          candidates: 2
        } );
        expect( list.note ).toMatch( /Accepting is the person's/ );
      }
    );

    it(
      "build the carousel from accepted pieces only",
      async() => {
        const {
          registry, handles
        } = setup();

        for ( const values of [
          {
            render: {
              palette: "sunset"
            }
          },
          {
            render: {
              hueSpeed: 2
            }
          }
        ] ) {
          await registry.execute(
            "variations.keep",
            {
              values
            }
          );
          await new Promise( ( resolve ) => setTimeout(
            resolve,
            3
          ) );
        }

        await expect( registry.execute(
          "variations.build",
          {
            discard: true
          }
        ) ).rejects.toThrow( /0 accepted variations.*2 candidates wait/ );

        // The person accepts both in the gallery.
        for ( const entry of await handles.gallery.store.entries() ) {
          await handles.gallery.store.mark(
            entry.id,
            {
              ...entry.variation!,
              state: "accepted"
            }
          );
        }

        const built = await registry.execute(
          "variations.build",
          {
            discard: true
          }
        ) as { slides: string[] };

        expect( built.slides ).toHaveLength( 2 );
        expect( ( handles.getValues( "slides" ) as { sketch: { render: Record<string, unknown> } }[] ).map( ( s ) => s.sketch.render ) ).toEqual( [
          {
            hueSpeed: 0,
            palette: "sunset"
          },
          {
            hueSpeed: 2,
            palette: "rainbow"
          }
        ] );
      }
    );

    it(
      "open the Variations beat as the carousel once three pieces are accepted",
      async() => {
        const {
          registry, handles, plan, staged
        } = setup();

        handles.sketchId = "p5/materials/materials-v3-smoke";

        const local = createCommandRegistry();

        local.register( [
          ...planCommands( handles ),
          ...campaignCommands( handles ),
          ...variationCommands( handles )
        ] );

        const at = await slotOf(
          plan,
          "p5/materials/materials-v3-smoke"
        );

        await local.execute(
          "campaign.create",
          {
            at
          }
        );
        for ( const hueSpeed of [
          1,
          2,
          3
        ] ) {
          const kept = await local.execute(
            "variations.keep",
            {
              values: {
                render: {
                  hueSpeed
                }
              }
            }
          ) as { id: string };
          const entry = ( await handles.gallery.store.get( kept.id ) )!;

          await handles.gallery.store.mark(
            kept.id,
            {
              ...entry.variation!,
              state: "accepted"
            }
          );
          await new Promise( ( resolve ) => setTimeout(
            resolve,
            3
          ) );
        }

        const variations = ( await plan() ).slots.find( ( s ) => s.campaign?.beat === "variations" )!;

        expect( variations.campaign!.waitsFor ).toBeUndefined();
        await local.execute(
          "plan.open",
          {
            at: variations.at
          }
        );
        // Already on the sketch: the carousel is applied in place, three slides.
        expect( ( handles.getValues( "slides" ) as unknown[] ).length ).toBe( 3 );
        expect( staged ).toEqual( [] );
        expect( registry ).toBeDefined();
      }
    );
  }
);
