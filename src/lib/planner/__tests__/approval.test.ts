import {
  lineStatus, queueable, quotesPiece, tickedAccounts, wordsStamp
} from "../approval";
import {
  EMPTY_CHOICES, planSlots, type HeldLine, type PlanChoices, type PlanSketch, type Proposal
} from "../planner";
import {
  readChoices, readHeld
} from "../planStore";
import {
  postsOnSlot, slotProblem
} from "../runner";
import {
  readRun, runAlive, runInterrupted, RUN_SILENT_MS
} from "../runStore";
import {
  wantedVariants
} from "../usualVariants";
import {
  VARIANT_PRESETS
} from "../../export/variants";
import {
  DEFAULT_PHRASES
} from "../../postiz/pills";
import {
  postKeyOfProposal, reelPostKey, sketchOfPostKey
} from "../../postiz/postKey";
import {
  DEFAULT_DRAFT, type PostDraft
} from "../../postiz/publishStore";
import {
  DEFAULT_RHYTHM
} from "../../postiz/rhythm";
import type {
  PostizConnection
} from "../../postiz/store";

const NOW = Date.parse( "2026-11-20T12:00:00Z" );
const TUE = "2026-11-24T08:00:00.000Z";
const FRI = "2026-11-27T18:00:00.000Z";
const SUN = "2026-11-29T09:00:00.000Z";

const channel = (
  id: string, identifier: string
) => ( {
  id,
  name: id,
  identifier,
  picture: null,
  disabled: false,
  handle: null
} );
const conn: PostizConnection = {
  apiBase: "https://postiz.example/api/public/v1",
  apiKey: "KEY",
  channels: [
    channel(
      "ig",
      "instagram"
    ),
    channel(
      "x",
      "x"
    )
  ],
  defaultChannelIds: [
    "ig",
    "x"
  ],
  collaborator: "",
  handles: {},
  usual: {},
  rhythm: DEFAULT_RHYTHM,
  phrases: DEFAULT_PHRASES,
  dayStart: null,
  connectedAt: 0
};
const draft = ( patch: Partial<PostDraft> = {} ): PostDraft => ( {
  ...DEFAULT_DRAFT,
  ...patch
} );

const sketch = (
  name: string, category: string, extra: Partial<PlanSketch> = {}
): PlanSketch => ( {
  engine: "p5",
  name,
  category,
  createdAt: "2026-11-10",
  ...extra
} );
const CATALOGUE = [
  sketch(
    "materials-v1-flame",
    "materials"
  ),
  sketch(
    "materials-v2-water",
    "materials"
  ),
  sketch(
    "iridescent-v5-spiral-bloom",
    "iridescent"
  ),
  sketch(
    "sculpt-v4-sphere",
    "sculpt"
  )
];
const SLOTS = [
  TUE,
  FRI,
  SUN
].map( ( iso ) => new Date( iso ) );
const plan = (
  choices: Partial<PlanChoices>, slots = SLOTS
) => planSlots( {
  catalogue: CATALOGUE,
  slots,
  posted: [],
  choices: {
    ...EMPTY_CHOICES,
    mix: "fresh",
    ...choices
  },
  now: NOW
} );
const hold = (
  proposal: Proposal, patch: Partial<HeldLine> = {}
): HeldLine => ( {
  proposal,
  postKey: postKeyOfProposal( proposal ),
  stamp: "s",
  approvedAt: NOW,
  state: "waiting",
  ...patch
} );

describe(
  "approving a line of the plan in place",
  () => {
    it(
      "stamps the words: any change to them, the note or the accounts gives another stamp",
      () => {
        const base = wordsStamp(
          draft(),
          conn
        );

        expect( wordsStamp(
          draft(),
          conn
        ) ).toBe( base );
        // The same accounts said explicitly read the same.
        expect( wordsStamp(
          draft( {
            channelIds: [
              "x",
              "ig"
            ]
          } ),
          conn
        ) ).toBe( base );
        for ( const changed of [
          draft( {
            caption: "{title}\nNew words"
          } ),
          draft( {
            note: "made on a train"
          } ),
          draft( {
            own: {
              x: "short"
            }
          } ),
          draft( {
            channelIds: [
              "ig"
            ]
          } ),
          draft( {
            shortCaption: "{title}"
          } )
        ] ) {
          expect( wordsStamp(
            changed,
            conn
          ) ).not.toBe( base );
        }
        // An account that is not ticked may have words of its own: they are not sent, so not stamped.
        expect( wordsStamp(
          draft( {
            channelIds: [
              "ig"
            ],
            own: {
              x: "unused"
            }
          } ),
          conn
        ) ).toBe( wordsStamp(
          draft( {
            channelIds: [
              "ig"
            ]
          } ),
          conn
        ) );
        expect( tickedAccounts(
          draft( {
            collabAccounts: [
              "x"
            ]
          } ),
          conn
        ) ).toEqual( [
          "ig"
        ] );
      }
    );

    it(
      "keeps an approved line where it is while the plan moves around it",
      () => {
        const before = plan( {} );
        const second = before[ 1 ].proposal!;
        const held = {
          [ FRI ]: hold( second )
        };
        // The first proposal is passed over: without the hold, everything after it would shift.
        const after = plan( {
          held,
          passed: {
            [ before[ 0 ].proposal!.key ]: NOW
          }
        } );

        expect( after[ 1 ].proposal ).toEqual( second );
        expect( after[ 1 ].held ).toBe( held[ FRI ] );
        // …and its sketch is proposed on no other slot.
        expect( after.filter( ( s ) => s.proposal?.sketchKey === second.sketchKey ) ).toHaveLength( 1 );
        expect( after[ 0 ].proposal?.sketchKey ).not.toBe( before[ 0 ].proposal!.sketchKey );
      }
    );

    it(
      "says when another post took an approved line's slot, and keeps a planned line",
      () => {
        const first = plan( {} )[ 0 ].proposal!;
        // Tuesday is no longer among the free slots.
        const gone = plan(
          {
            held: {
              [ TUE ]: hold( first )
            }
          },
          SLOTS.slice( 1 )
        );

        expect( gone[ 0 ] ).toMatchObject( {
          slot: TUE,
          taken: true
        } );
        expect( lineStatus(
          gone[ 0 ],
          "s"
        ) ).toBe( "taken" );

        // Once planned, the post on its slot is its own.
        const planned = plan(
          {
            held: {
              [ TUE ]: hold(
                first,
                {
                  state: "planned"
                }
              )
            }
          },
          SLOTS.slice( 1 )
        );

        expect( planned[ 0 ].taken ).toBeUndefined();
        expect( lineStatus(
          planned[ 0 ],
          "other"
        ) ).toBe( "planned" );
      }
    );

    it(
      "reads a line's standing from its stamp and the queue",
      () => {
        const p = plan( {} )[ 0 ].proposal!;
        const slot = ( patch: Partial<HeldLine> ) => ( {
          proposal: p,
          skipped: false,
          held: hold(
            p,
            patch
          )
        } );

        expect( lineStatus(
          {
            proposal: p,
            skipped: false
          },
          "s"
        ) ).toBe( "proposed" );
        expect( lineStatus(
          slot( {} ),
          "s"
        ) ).toBe( "approved" );
        expect( lineStatus(
          slot( {} ),
          "changed"
        ) ).toBe( "reworded" );
        expect( lineStatus(
          slot( {
            stamp: null
          } ),
          "s"
        ) ).toBe( "reworded" );
        // A line left «rendering» by a tab that went away is approved again, not stuck.
        expect( lineStatus(
          slot( {
            state: "rendering"
          } ),
          "s",
          false
        ) ).toBe( "approved" );
        expect( lineStatus(
          slot( {
            state: "rendering"
          } ),
          "s",
          true
        ) ).toBe( "rendering" );
        expect( lineStatus(
          slot( {
            state: "failed",
            error: "no"
          } ),
          "s"
        ) ).toBe( "failed" );
        expect( [
          "approved",
          "failed"
        ].map( ( s ) => queueable( s as "approved" ) ) ).toEqual( [
          true,
          true
        ] );
        expect( [
          "proposed",
          "reworded",
          "taken",
          "planned",
          "rendering"
        ].some( ( s ) => queueable( s as "proposed" ) ) ).toBe( false );
      }
    );

    it(
      "reads approved lines back from storage, drops what is malformed or gone by",
      () => {
        const p = plan( {} )[ 0 ].proposal!;
        const stored = JSON.parse( JSON.stringify( {
          held: {
            [ TUE ]: hold(
              p,
              {
                state: "failed",
                error: "Another post took it",
                sending: true
              }
            ),
            "2026-11-01T08:00:00.000Z": hold( p ),
            [ FRI ]: {
              postKey: 3
            }
          }
        } ) );
        const read = readChoices(
          stored,
          NOW
        );

        expect( Object.keys( read.held ) ).toEqual( [
          TUE
        ] );
        expect( read.held[ TUE ] ).toMatchObject( {
          state: "failed",
          error: "Another post took it",
          sending: true,
          postKey: p.sketchKey
        } );
        expect( readHeld( null ) ).toBeNull();
        expect( readChoices(
          {},
          NOW
        ).held ).toEqual( {} );
      }
    );

    it(
      "gives a reel its own post, and keeps its sends with the host sketch",
      () => {
        expect( reelPostKey( "series:p5/materials" ) ).toBe( "p5/empty-sketch@series:p5/materials" );
        expect( sketchOfPostKey( "p5/empty-sketch@pin:2026-11-24T08:00:00.000Z" ) ).toBe( "p5/empty-sketch" );
        expect( sketchOfPostKey( "p5/torsade-v0" ) ).toBe( "p5/torsade-v0" );
        expect( postKeyOfProposal( {
          key: "recap:2026-11",
          sketchKey: "p5/empty-sketch",
          reel: {}
        } ) ).not.toBe( postKeyOfProposal( {
          key: "series:p5/rings",
          sketchKey: "p5/empty-sketch",
          reel: {}
        } ) );
        expect( postKeyOfProposal( {
          key: "drop:p5/torsade-v0",
          sketchKey: "p5/torsade-v0"
        } ) ).toBe( "p5/torsade-v0" );
      }
    );

    it(
      "says which words quote the piece itself",
      () => {
        expect( quotesPiece( "{title}\n{engine} · {loop}" ) ).toBe( true );
        expect( quotesPiece( "Post {postNo|fmt=hash}" ) ).toBe( true );
        expect( quotesPiece( "{title}\n{description}\n{tags}" ) ).toBe( false );
      }
    );
  }
);

describe(
  "the render queue",
  () => {
    const post = (
      publishDate: string, state = "scheduled", id = "p1"
    ) => ( {
      id,
      publishDate,
      state
    } );

    it(
      "checks the slot against the calendar as it is at send time",
      () => {
        const now = new Date( NOW );

        expect( slotProblem(
          conn,
          [],
          TUE,
          now
        ) ).toBeNull();
        // Another app's post on that very instant, or anywhere that day, closes it.
        expect( slotProblem(
          conn,
          [
            post( TUE )
          ],
          TUE,
          now
        ) ).toMatch( /took Tue 24 Nov/ );
        expect( slotProblem(
          conn,
          [
            post( "2026-11-24T15:00:00.000Z" )
          ],
          TUE,
          now
        ) ).toMatch( /nothing was sent/ );
        // A draft or a failure holds no slot.
        expect( slotProblem(
          conn,
          [
            post(
              TUE,
              "draft"
            ),
            post(
              TUE,
              "error"
            )
          ],
          TUE,
          now
        ) ).toBeNull();
        expect( slotProblem(
          conn,
          [],
          TUE,
          new Date( Date.parse( TUE ) + 1 )
        ) ).toMatch( /went by/ );
      }
    );

    it(
      "finds the post a cut run may already have sent, by its exact instant",
      () => {
        expect( postsOnSlot(
          [
            post( TUE ),
            post(
              TUE,
              "error",
              "p2"
            ),
            post(
              FRI,
              "scheduled",
              "p3"
            )
          ],
          TUE
        ) ).toEqual( [
          "p1"
        ] );
      }
    );

    it(
      "reads a run back, and tells a live one from one whose tab went away",
      () => {
        const run = readRun( {
          id: "run-1",
          slots: [
            TUE,
            "not a date",
            FRI
          ],
          index: 1,
          state: "running",
          origin: "//evil.example",
          beat: NOW,
          phase: "rendering",
          progress: 0.4
        } )!;

        expect( run.slots ).toEqual( [
          TUE,
          FRI
        ] );
        expect( run.origin ).toBe( "/gallery" );
        expect( runAlive(
          run,
          NOW + 1_000
        ) ).toBe( true );
        expect( runInterrupted(
          run,
          NOW + RUN_SILENT_MS + 1
        ) ).toBe( true );
        // Past its last line, a run is over whatever it says.
        expect( readRun( {
          ...run,
          index: 2
        } )!.state ).toBe( "done" );
        expect( readRun( {
          slots: []
        } ) ).toBeNull();
        expect( runAlive(
          null,
          NOW
        ) ).toBe( false );
      }
    );

    it(
      "adds the variants the accounts' usual formats ask for, once each",
      () => {
        const wanted = wantedVariants(
          {
            ig: "video 9:16",
            x: "picture 4:5",
            th: "picture 4:5",
            yt: "video 4:5",
            odd: "pictures 3:4"
          },
          [
            "ig",
            "x",
            "th",
            "yt",
            "odd",
            "none"
          ],
          [
            "video 4:5"
          ],
          VARIANT_PRESETS
        );

        expect( wanted ).toEqual( [
          {
            format: "video 9:16",
            preset: "reel",
            patch: {}
          },
          {
            format: "picture 4:5",
            preset: "still",
            patch: {
              size: {
                width: 1080,
                height: 1350
              },
              name: "Still 4:5"
            }
          }
        ] );
      }
    );
  }
);
