import {
  beatOf, beatProblem, CAMPAIGN_WEEKS, layCampaigns, makeCampaign, planWithCampaigns, previewCampaign, shortName, TEMPLATES, templatesFor, type Campaign
} from "../campaign";
import {
  clearCampaignStore, addCampaign, dropCampaign, getCampaigns, markBeatOpened, passBeat, readCampaigns
} from "../campaignStore";
import {
  EMPTY_CHOICES, PLAN_WEEKS, type PlanSketch
} from "../planner";
import {
  planFreeSlots
} from "../slots";
import {
  DEFAULT_RHYTHM, localDay
} from "../../postiz/rhythm";

// A Friday, noon UTC: the default rhythm (Tue 09:00, Fri 19:00, Sun 10:00, Paris) still has today's slot ahead.
const NOW = Date.parse( "2026-11-20T12:00:00Z" );
const TZ = DEFAULT_RHYTHM.timeZone;

const sketch = (
  name: string, category: string | null, createdAt: string, extra: Partial<PlanSketch> = {}
): PlanSketch => ( {
  engine: "p5",
  name,
  category,
  createdAt,
  ...extra
} );

const SMOKE = sketch(
  "materials-v3-smoke",
  "materials",
  "2026-11-11"
);
const FLYBY = sketch(
  "rings-v10-magnetic-flyby",
  "rings",
  "2026-08-14",
  {
    favorite: true
  }
);
const CATALOGUE: PlanSketch[] = [
  SMOKE,
  sketch(
    "materials-v2-water",
    "materials",
    "2026-11-10"
  ),
  sketch(
    "materials-v1-flame",
    "materials",
    "2026-11-09"
  ),
  FLYBY,
  sketch(
    "rings-v9-flick-reveal",
    "rings",
    "2026-08-09",
    {
      favorite: true
    }
  ),
  sketch(
    "sculpt-v1-scatter-lattice",
    "sculpt",
    "2026-09-21"
  ),
  sketch(
    "hero",
    null,
    "2026-10-01",
    {
      engine: "gsap"
    }
  ),
  sketch(
    "empty-sketch",
    null,
    "2026-01-01",
    {
      hiddenFromGallery: true
    }
  )
];

const far = planFreeSlots(
  DEFAULT_RHYTHM,
  [],
  new Date( NOW ),
  CAMPAIGN_WEEKS
);
const near = planFreeSlots(
  DEFAULT_RHYTHM,
  [],
  new Date( NOW ),
  PLAN_WEEKS
);
const TUE = far.find( ( at ) => localDay(
  at,
  TZ
) === "2026-11-24" )!.toISOString();

const days = ( laid: ReturnType<typeof layCampaigns>[ number ] ) => laid.beats.map( ( b ) => b.at === null ? null : localDay(
  new Date( b.at ),
  TZ
) );

const campaign = (
  s: PlanSketch, template: Campaign[ "template" ], off: string[] = []
) => makeCampaign(
  s,
  CATALOGUE,
  template,
  TUE,
  NOW,
  "person",
  off
);

const lay = (
  campaigns: Campaign[], more: Partial<Parameters<typeof layCampaigns>[ 0 ]> = {}
) => layCampaigns( {
  campaigns,
  slots: far,
  posted: [],
  catalogue: CATALOGUE,
  now: NOW,
  timeZone: TZ,
  ...more
} );

describe(
  "campaign templates",
  () => {
    it(
      "counts each template's beats in days from the release, as lab 9 drew them",
      () => {
        expect( TEMPLATES.drop.beats.map( ( b ) => [
          b.offset,
          b.label
        ] ) ).toEqual( [
          [
            0,
            "Release"
          ],
          [
            3,
            "Variations"
          ],
          [
            7,
            "How it's made"
          ],
          [
            56,
            "Comeback"
          ]
        ] );
        expect( TEMPLATES.comeback.beats.map( ( b ) => b.offset ) ).toEqual( [
          0,
          4,
          10
        ] );
        expect( TEMPLATES.finale.beats.map( ( b ) => [
          b.offset,
          b.kind
        ] ) ).toEqual( [
          [
            0,
            "sketch"
          ],
          [
            2,
            "series"
          ],
          [
            7,
            "words"
          ],
          [
            56,
            "series"
          ]
        ] );
      }
    );

    it(
      "offers a comeback for a favourite, a release otherwise, the finale for the last of a series",
      () => {
        expect( templatesFor(
          FLYBY,
          CATALOGUE
        ) ).toEqual( [
          "comeback",
          "drop"
        ] );
        expect( templatesFor(
          SMOKE,
          CATALOGUE
        ) ).toEqual( [
          "drop",
          "finale"
        ] );
        expect( templatesFor(
          CATALOGUE[ 1 ],
          CATALOGUE
        ) ).toEqual( [
          "drop"
        ] );
      }
    );

    it(
      "leaves out a beat the sketch cannot carry, and says why",
      () => {
        const gsap = CATALOGUE.find( ( s ) => s.engine === "gsap" )!;

        expect( beatProblem(
          TEMPLATES.drop.beats[ 2 ],
          gsap,
          CATALOGUE
        ) ).toMatch( /p5 sketches only/ );
        expect( makeCampaign(
          gsap,
          CATALOGUE,
          "drop",
          TUE,
          NOW
        ).off ).toEqual( [
          "process"
        ] );
        expect( beatProblem(
          TEMPLATES.finale.beats[ 1 ],
          FLYBY,
          CATALOGUE
        ) ).toMatch( /takes 3/ );
        expect( shortName( "Materials · Smoke" ) ).toBe( "Smoke" );
        expect( shortName( "Voronoi cells" ) ).toBe( "Voronoi cells" );
      }
    );
  }
);

describe(
  "layCampaigns",
  () => {
    it(
      "puts each beat on the first free slot on or after its day",
      () => {
        const [
          laid
        ] = lay( [
          campaign(
            SMOKE,
            "drop"
          )
        ] );

        // Tue 24 Nov; +3 = Fri 27; +7 = Tue 1 Dec; +56 = Tue 19 Jan.
        expect( days( laid ) ).toEqual( [
          "2026-11-24",
          "2026-11-27",
          "2026-12-01",
          "2027-01-19"
        ] );
        expect( laid.beats.map( ( b ) => b.state ) ).toEqual( [
          "proposed",
          "proposed",
          "proposed",
          "proposed"
        ] );
        expect( laid.beats.map( ( b ) => b.index ) ).toEqual( [
          1,
          2,
          3,
          4
        ] );
        expect( laid.total ).toBe( 4 );
        expect( laid.name ).toBe( "Smoke" );
      }
    );

    it(
      "moves a beat past a slot it may not take, and never before the beat it follows",
      () => {
        const friday = far.find( ( at ) => localDay(
          at,
          TZ
        ) === "2026-11-27" )!.toISOString();
        const [
          laid
        ] = lay(
          [
            campaign(
              FLYBY,
              "comeback"
            )
          ],
          {
            blocked: new Set( [
              TUE,
              friday
            ] )
          }
        );

        // Day 0 slips to Fri… which is blocked too → Sun 29; +4 = Thu 3 Dec → Fri 4; +10 = Wed 9 → Fri 11.
        expect( days( laid ) ).toEqual( [
          "2026-11-29",
          "2026-12-04",
          "2026-12-11"
        ] );
      }
    );

    it(
      "keeps one campaign to the week's cap",
      () => {
        const [
          laid
        ] = lay(
          [
            campaign(
              SMOKE,
              "drop",
              [
                "comeback"
              ]
            )
          ],
          {
            weekCap: 1
          }
        );

        // Fri 27 is the release's week: the variations wait for Tue 1 Dec, the breakdown for the week after.
        expect( days( laid ) ).toEqual( [
          "2026-11-24",
          "2026-12-01",
          "2026-12-08",
          null
        ] );
        expect( laid.beats[ 3 ].state ).toBe( "off" );
      }
    );

    it(
      "never gives one slot to two campaigns",
      () => {
        const laid = lay( [
          campaign(
            SMOKE,
            "drop"
          ),
          {
            ...campaign(
              FLYBY,
              "comeback"
            ),
            createdAt: NOW + 1
          }
        ] );
        const taken = laid.flatMap( ( c ) => c.beats.map( ( b ) => b.slot ) ).filter( Boolean );

        expect( new Set( taken ).size ).toBe( taken.length );
        // The second campaign's day 0 was the first one's: it starts on the next free slot.
        expect( days( laid[ 1 ] )[ 0 ] ).toBe( "2026-11-29" );
      }
    );

    it(
      "reads a post of the sketch as its beat, and counts the days from where the release really went",
      () => {
        const friday = Date.parse( "2026-11-27T18:00:00Z" );
        const [
          laid
        ] = lay(
          [
            campaign(
              SMOKE,
              "drop"
            )
          ],
          {
            // The release was moved to Friday in Publish; that slot is no longer free.
            posted: [
              {
                sketchKey: "p5/materials-v3-smoke",
                at: friday
              }
            ],
            slots: far.filter( ( at ) => at.getTime() !== friday )
          }
        );

        expect( laid.beats[ 0 ].state ).toBe( "queued" );
        // +3 from Friday = Mon 30 → Tue 1 Dec; +7 = Fri 4 Dec.
        expect( days( laid ).slice(
          0,
          3
        ) ).toEqual( [
          "2026-11-27",
          "2026-12-01",
          "2026-12-04"
        ] );
        expect( laid.live ).toBe( true );
      }
    );

    it(
      "gives a post to the beat that was opened on its day, not to the first one waiting",
      () => {
        const c = campaign(
          SMOKE,
          "drop"
        );
        const release = Date.parse( TUE );
        const process = far.find( ( at ) => localDay(
          at,
          TZ
        ) === "2026-12-01" )!;
        const [
          laid
        ] = lay(
          [
            {
              ...c,
              opened: {
                process: {
                  at: NOW,
                  slot: process.toISOString()
                }
              }
            }
          ],
          {
            posted: [
              {
                sketchKey: c.sketchKey,
                at: release
              },
              {
                sketchKey: c.sketchKey,
                at: process.getTime()
              }
            ],
            slots: far.filter( ( at ) => at.getTime() !== release && at.getTime() !== process.getTime() )
          }
        );

        expect( laid.beats.map( ( b ) => b.state ) ).toEqual( [
          "queued",
          "proposed",
          "queued",
          "proposed"
        ] );
      }
    );

    it(
      "counts a reel's post only for a beat that was opened: every reel is posted from one host",
      () => {
        const c = campaign(
          SMOKE,
          "finale"
        );
        const reel = {
          sketchKey: "p5/empty-sketch",
          at: Date.parse( "2026-11-27T18:00:00Z" )
        };

        expect( lay(
          [
            c
          ],
          {
            posted: [
              reel
            ]
          }
        )[ 0 ].beats[ 1 ].state ).toBe( "proposed" );
        expect( lay(
          [
            {
              ...c,
              opened: {
                series: {
                  at: NOW,
                  slot: new Date( reel.at ).toISOString()
                }
              }
            }
          ],
          {
            posted: [
              reel
            ]
          }
        )[ 0 ].beats[ 1 ].state ).toBe( "queued" );
      }
    );

    it(
      "says what a beat waits for",
      () => {
        const c = campaign(
          SMOKE,
          "drop"
        );

        expect( lay( [
          c
        ] )[ 0 ].beats[ 1 ].needs ).toBe( "3 accepted variations — 0 so far" );
        expect( lay(
          [
            c
          ],
          {
            accepted: {
              [ c.sketchKey ]: 3
            }
          }
        )[ 0 ].beats[ 1 ].needs ).toBeNull();
        expect( lay( [
          campaign(
            SMOKE,
            "finale"
          )
        ] )[ 0 ].beats[ 2 ].needs ).toBe( "your words on the card" );
      }
    );

    it(
      "is over once every beat that is on went out",
      () => {
        const c = campaign(
          FLYBY,
          "comeback",
          [
            "variations",
            "process"
          ]
        );
        const [
          laid
        ] = lay(
          [
            c
          ],
          {
            now: Date.parse( "2026-12-20T12:00:00Z" ),
            posted: [
              {
                sketchKey: c.sketchKey,
                at: Date.parse( TUE )
              }
            ]
          }
        );

        expect( laid.beats[ 0 ].state ).toBe( "posted" );
        expect( laid.live ).toBe( false );
      }
    );

    it(
      "previews a draft beside the campaigns already there",
      () => {
        const first = campaign(
          SMOKE,
          "drop"
        );
        const draft = campaign(
          FLYBY,
          "comeback"
        );
        const preview = previewCampaign(
          {
            campaigns: [
              first
            ],
            slots: far,
            posted: [],
            catalogue: CATALOGUE,
            now: NOW,
            timeZone: TZ
          },
          draft
        );

        expect( preview.campaign.id ).toBe( draft.id );
        expect( days( preview )[ 0 ] ).toBe( "2026-11-29" );
      }
    );
  }
);

describe(
  "planWithCampaigns",
  () => {
    const plan = (
      campaigns: Campaign[], choices = EMPTY_CHOICES
    ) => planWithCampaigns(
      {
        catalogue: CATALOGUE,
        slots: near,
        farSlots: far,
        posted: [],
        choices,
        now: NOW,
        timeZone: TZ
      },
      campaigns
    );

    it(
      "is the plan itself when there is no campaign",
      () => {
        const {
          slots, campaigns
        } = plan( [] );

        expect( campaigns ).toEqual( [] );
        expect( slots.every( ( s ) => beatOf( s.proposal ) === null ) ).toBe( true );
      }
    );

    it(
      "makes each beat a line of the plan wearing its tag, and proposes the sketch nowhere else",
      () => {
        const c = campaign(
          SMOKE,
          "drop"
        );
        const {
          slots
        } = plan( [
          c
        ] );
        const beats = slots.filter( ( s ) => beatOf( s.proposal ) );

        expect( beats.map( ( s ) => [
          localDay(
            s.at,
            TZ
          ),
          s.proposal!.title,
          `${ beatOf( s.proposal )!.index }/${ beatOf( s.proposal )!.total }`
        ] ) ).toEqual( [
          [
            "2026-11-24",
            "Materials · Smoke · Release",
            "1/4"
          ],
          [
            "2026-11-27",
            "Materials · Smoke · Variations",
            "2/4"
          ],
          // Tue 1 Dec is November's recap: a recap keeps its rendezvous, the beat moves on.
          [
            "2026-12-04",
            "Materials · Smoke · How it's made",
            "3/4"
          ]
        ] );
        expect( slots.find( ( s ) => localDay(
          s.at,
          TZ
        ) === "2026-12-01" )!.proposal!.key ).toBe( "recap:2026-11" );
        expect( beats[ 0 ].proposal!.key ).toBe( `campaign:${ c.id }:release` );
        expect( beats[ 0 ].proposal!.pin ).toBeUndefined();
        expect( beats[ 1 ].proposal!.why ).toMatch( /Waits for 3 accepted variations/ );
        expect( slots.filter( ( s ) => s.proposal?.sketchKey === c.sketchKey && !beatOf( s.proposal ) ) ).toEqual( [] );
      }
    );

    it(
      "builds the series beat as the series' reel and the words beat on the host",
      () => {
        const {
          slots
        } = plan( [
          campaign(
            SMOKE,
            "finale"
          )
        ] );
        const series = slots.find( ( s ) => beatOf( s.proposal )?.beat === "series" )!.proposal!;
        const words = slots.find( ( s ) => beatOf( s.proposal )?.beat === "words" )!.proposal!;

        expect( series.reel?.sketches ).toEqual( [
          "p5/materials-v1-flame",
          "p5/materials-v2-water",
          "p5/materials-v3-smoke"
        ] );
        expect( series.sketchKey ).toBe( "p5/empty-sketch" );
        expect( words.sketchKey ).toBe( "p5/empty-sketch" );
        expect( words.pillar ).toBe( "series" );
        // The Plan's own Series pillar does not propose the same reel beside the campaign.
        expect( slots.filter( ( s ) => s.proposal?.key === "series:p5/materials" ) ).toEqual( [] );
      }
    );

    it(
      "leaves a skipped slot empty and moves the beat on",
      () => {
        const {
          slots
        } = plan(
          [
            campaign(
              SMOKE,
              "drop"
            )
          ],
          {
            ...EMPTY_CHOICES,
            skipped: {
              [ TUE ]: NOW
            }
          }
        );

        expect( slots.find( ( s ) => s.slot === TUE )!.skipped ).toBe( true );
        expect( localDay(
          slots.find( ( s ) => beatOf( s.proposal )?.beat === "release" )!.at,
          TZ
        ) ).toBe( "2026-11-27" );
      }
    );
  }
);

describe(
  "campaignStore",
  () => {
    beforeEach( clearCampaignStore );

    it(
      "reads back only what is a campaign, and forgets one whose day 0 is long gone",
      () => {
        const good = campaign(
          SMOKE,
          "drop"
        );

        expect( readCampaigns(
          {
            campaigns: [
              good,
              {
                ...good,
                id: "bad key",
                sketchKey: "../etc"
              },
              {
                ...good,
                id: "unknown-template",
                template: "viral"
              },
              {
                ...good,
                id: "old",
                start: "2026-01-01T09:00:00.000Z"
              },
              {
                ...good,
                id: "marks",
                off: [
                  "process",
                  "nonsense"
                ],
                opened: {
                  release: {
                    at: 1,
                    slot: TUE
                  },
                  nonsense: {
                    at: 1,
                    slot: TUE
                  },
                  process: {
                    at: "x",
                    slot: TUE
                  }
                },
                by: "robot"
              },
              "junk"
            ]
          },
          NOW
        ) ).toEqual( [
          good,
          {
            ...good,
            id: "marks",
            off: [
              "process"
            ],
            opened: {
              release: {
                at: 1,
                slot: TUE
              }
            },
            by: "person"
          }
        ] );
        expect( readCampaigns(
          "nonsense",
          NOW
        ) ).toEqual( [] );
      }
    );

    it(
      "keeps, passes, marks and drops",
      () => {
        const c = campaign(
          SMOKE,
          "drop"
        );

        addCampaign( c );
        expect( getCampaigns() ).toEqual( [
          c
        ] );
        passBeat(
          c.id,
          "process"
        );
        expect( getCampaigns()[ 0 ].off ).toEqual( [
          "process"
        ] );
        passBeat(
          c.id,
          "process",
          false
        );
        markBeatOpened(
          c.id,
          "release",
          TUE
        );
        expect( getCampaigns()[ 0 ].off ).toEqual( [] );
        expect( getCampaigns()[ 0 ].opened.release.slot ).toBe( TUE );
        dropCampaign( c.id );
        expect( getCampaigns() ).toEqual( [] );
      }
    );
  }
);
