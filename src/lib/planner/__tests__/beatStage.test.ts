import parseImportedOptions from "../../../utils/parseImportedOptions";
import type {
  GalleryEntry
} from "../../gallery/types";
import {
  acceptedCounts, pieceSettings, variationsDocument, variationsOf
} from "../../variations/kept";
import {
  PROCESS_ITEM_SEED, readStage, stageBeat, withBreakdown, wordsDocument, WORDS_PLACEHOLDER
} from "../beatStage";
import type {
  BeatTag
} from "../campaign";
import type {
  Proposal
} from "../planner";

const piece = (
  id: string, at: number, palette: string, state?: "candidate" | "accepted", extra: Partial<GalleryEntry> = {}
): GalleryEntry => ( {
  id,
  at,
  sketch: "p5/materials/materials-v7-smoke",
  engine: "p5",
  name: "materials-v7-smoke",
  title: "",
  origin: "agent",
  options: {
    id: "job-1",
    name: "materials-v7-smoke",
    size: {
      width: 1080,
      height: 1350
    },
    sketch: {
      palette,
      plume: {
        size: 1
      }
    }
  },
  fingerprint: id,
  hadAssets: false,
  width: 1080,
  height: 1350,
  thumbnail: null,
  ...( state
    ? {
      variation: {
        state,
        by: "agent",
        label: `Palette: ${ palette }`
      }
    }
    : {} ),
  ...extra
} );

const PIECES = [
  piece(
    "a",
    1,
    "riso",
    "accepted"
  ),
  piece(
    "b",
    2,
    "chrome",
    "candidate"
  ),
  piece(
    "c",
    3,
    "acid",
    "accepted"
  ),
  piece(
    "d",
    4,
    "holo",
    "accepted"
  ),
  piece(
    "plain",
    5,
    "original"
  ),
  piece(
    "other",
    6,
    "riso",
    "accepted",
    {
      name: "materials-v1-flame"
    }
  )
];

const tag = ( more: Partial<BeatTag> ): BeatTag => ( {
  id: "c1",
  beat: "variations",
  kind: "variations",
  label: "Variations",
  what: "",
  sketchKey: "p5/materials-v7-smoke",
  series: "Materials",
  name: "Smoke",
  index: 2,
  total: 4,
  by: "person",
  needs: null,
  trial: false,
  opened: false,
  ...more
} );

const proposal: Proposal = {
  key: "campaign:c1:variations",
  pillar: "drop",
  sketchKey: "p5/materials-v7-smoke",
  path: "p5/materials/materials-v7-smoke",
  title: "Materials · Smoke · Variations",
  why: "",
  favorite: false
};

describe(
  "kept variations",
  () => {
    it(
      "lists a sketch's variations, the accepted first, and counts only those",
      () => {
        expect( variationsOf(
          PIECES,
          "p5/materials-v7-smoke"
        ).map( ( p ) => p.id ) ).toEqual( [
          "d",
          "c",
          "a",
          "b"
        ] );
        expect( acceptedCounts( PIECES ) ).toEqual( {
          "p5/materials-v7-smoke": 3,
          "p5/materials-v1-flame": 1
        } );
      }
    );

    it(
      "builds the carousel from accepted pieces only: one slide each, its own settings, a document the studio takes",
      () => {
        const document = variationsDocument(
          variationsOf(
            PIECES,
            "p5/materials-v7-smoke"
          ),
          3,
          5
        )!;
        const slides = document.slides as { name: string;
          sketch: { palette: string }; }[];

        expect( slides.map( ( s ) => [
          s.name,
          s.sketch.palette
        ] ) ).toEqual( [
          [
            "Palette: riso",
            "riso"
          ],
          [
            "Palette: acid",
            "acid"
          ],
          [
            "Palette: holo",
            "holo"
          ]
        ] );
        expect( document.id ).toBeUndefined();
        expect( document.name ).toBe( "materials-v7-smoke" );
        expect( parseImportedOptions( document ).ok ).toBe( true );
      }
    );

    it(
      "refuses to build with fewer accepted pieces than the post takes, and caps at the most",
      () => {
        expect( variationsDocument(
          PIECES.slice(
            0,
            2
          ),
          3,
          5
        ) ).toBeNull();
        expect( ( variationsDocument(
          PIECES.filter( ( p ) => p.name === "materials-v7-smoke" ),
          1,
          1
        )! ).slides ).toBeUndefined();
      }
    );

    it(
      "reads a piece's settings from its first slide over its root",
      () => {
        expect( pieceSettings( {
          sketch: {
            a: 1,
            b: 1
          },
          slides: [
            {
              sketch: {
                b: 2
              }
            }
          ]
        } ) ).toEqual( {
          a: 1,
          b: 2
        } );
      }
    );
  }
);

describe(
  "stageBeat",
  () => {
    it(
      "opens a release as the sketch is, marked a Trial Reel when the beat is one",
      () => {
        expect( stageBeat(
          proposal,
          tag( {
            kind: "sketch",
            trial: true
          } ),
          []
        ) ).toEqual( {
          ok: true,
          staged: {
            document: null,
            stage: null,
            caption: null,
            trial: true
          }
        } );
      }
    );

    it(
      "stages the variations only once enough were accepted",
      () => {
        const waiting = stageBeat(
          proposal,
          tag( {
            needs: "3 accepted variations — 1 so far",
            pieces: {
              min: 3,
              max: 5
            }
          } ),
          PIECES.slice(
            0,
            2
          )
        );

        expect( waiting.ok ).toBe( false );
        expect( !waiting.ok && waiting.reason ).toMatch( /3 accepted variations — 1 so far/ );

        const ready = stageBeat(
          proposal,
          tag( {
            pieces: {
              min: 3,
              max: 5
            }
          } ),
          PIECES
        );

        expect( ready.ok && ( ready.staged.document!.slides as unknown[] ).length ).toBe( 3 );
      }
    );

    it(
      "asks the sketch page for the breakdown, and hands the words card over as a document",
      () => {
        const process = stageBeat(
          proposal,
          tag( {
            kind: "process"
          } ),
          []
        );

        expect( process.ok && process.staged.stage ).toEqual( {
          kind: "process"
        } );

        const words = stageBeat(
          proposal,
          tag( {
            kind: "words"
          } ),
          []
        );

        expect( words.ok && parseImportedOptions( words.staged.document ).ok ).toBe( true );
        // The card is headed by the SERIES, not by the sketch that closes it.
        expect( words.ok && JSON.stringify( words.staged.document ) ).toContain( "MATERIALS" );
        expect( JSON.stringify( wordsDocument( "Materials" ) ) ).toContain( WORDS_PLACEHOLDER );
      }
    );

    it(
      "adds one breakdown, every group a step, and never a second",
      () => {
        const make = ( seed: Record<string, unknown> ) => ( {
          type: "breakdown",
          ...seed
        } );
        const content = withBreakdown(
          [
            {
              type: "text"
            }
          ],
          make
        )!;

        expect( content ).toHaveLength( 2 );
        expect( content[ 1 ] ).toEqual( {
          type: "breakdown",
          ...PROCESS_ITEM_SEED
        } );
        expect( withBreakdown(
          content,
          make
        ) ).toBeNull();
        expect( parseImportedOptions( {
          content: withBreakdown(
            undefined,
            make
          )
        } ).ok ).toBe( true );
      }
    );

    it(
      "takes a stage ask only for its sketch and only while fresh",
      () => {
        const raw = JSON.stringify( {
          sketchKey: "p5/x",
          stage: {
            kind: "process"
          },
          at: 1000
        } );

        expect( readStage(
          raw,
          "p5/x",
          2000
        ) ).toEqual( {
          kind: "process"
        } );
        expect( readStage(
          raw,
          "p5/y",
          2000
        ) ).toBeNull();
        expect( readStage(
          raw,
          "p5/x",
          1000 + 3 * 60 * 1000
        ) ).toBeNull();
        expect( readStage(
          "{",
          "p5/x",
          2000
        ) ).toBeNull();
      }
    );
  }
);
