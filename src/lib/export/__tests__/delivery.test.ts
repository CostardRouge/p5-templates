/**
 * @jest-environment jsdom
 */

/**
 * The one-prompt rule.
 *
 * Every assertion here is really the same one: however many files a run
 * produced, saving them raises AT MOST one prompt. Several unattended
 * downloads on a phone raise modal save sheets that overwrite one another, and
 * `<a download>` reports nothing back, so there is no way to sequence them —
 * which is how a two-variant export used to come home with one video.
 */

import {
  TextEncoder as NodeTextEncoder
} from "node:util";
import {
  downloadArtifacts,
  hasCoarsePointer,
  isDelivered,
  saveArtifacts,
  shouldDeferDelivery
} from "../delivery";
import type {
  ExportArtifact
} from "../runExportBatch";

/** What every fixture blob below contains. */
const PAYLOAD = "video-bytes";

const triggerDownload = jest.fn();

jest.mock(
  "../download",
  () => ( {
    ...jest.requireActual( "../download" ),
    triggerDownload: ( ...args: unknown[] ) => triggerDownload( ...args )
  } )
);

function artifact( fileName: string ): ExportArtifact {
  return {
    fileName,
    blob: new Blob(
      [
        PAYLOAD
      ],
      {
        type: "video/mp4"
      }
    )
  };
}

const TWO = [
  artifact( "braid-reel-1080x1920.mp4" ),
  artifact( "braid-post-1080x1350.mp4" )
];

function setShareApi( value: {
  share?: unknown;
  canShare?: unknown;
} ) {
  Object.defineProperty(
    navigator,
    "share",
    {
      value: value.share,
      configurable: true
    }
  );
  Object.defineProperty(
    navigator,
    "canShare",
    {
      value: value.canShare,
      configurable: true
    }
  );
}

function setPointer( coarse: boolean ) {
  Object.defineProperty(
    window,
    "matchMedia",
    {
      value: ( query: string ) => ( {
        matches: coarse && query.includes( "coarse" ),
        media: query
      } ),
      configurable: true
    }
  );
}

describe(
  "export delivery",
  () => {
    beforeEach( () => {
      triggerDownload.mockClear();
      setShareApi( {} );
      setPointer( false );

      // Two gaps in jsdom, neither of them in the code under test: its Blob has
      // no arrayBuffer() (every browser has had it since 2019) and it exposes
      // no global TextEncoder, which `createZip` needs for its filenames. The
      // stub returns the fixture payload every artifact below is built from.
      if ( typeof globalThis.TextEncoder === "undefined" ) {
        globalThis.TextEncoder = NodeTextEncoder as typeof globalThis.TextEncoder;
      }

      if ( !Blob.prototype.arrayBuffer ) {
        Blob.prototype.arrayBuffer = function arrayBuffer() {
          return Promise.resolve( new NodeTextEncoder().encode( PAYLOAD ).buffer );
        };
      }
    } );

    describe(
      "shouldDeferDelivery",
      () => {
        it(
          "holds files back on a touch device that can share them",
          () => {
            setPointer( true );
            setShareApi( {
              canShare: () => true
            } );

            expect( hasCoarsePointer() ).toBe( true );
            expect( shouldDeferDelivery( TWO ) ).toBe( true );
          }
        );

        it(
          "keeps the automatic download on a desktop that merely has a share sheet",
          () => {
            // Chrome and Safari on a laptop answer yes to canShare too, and
            // deferring there would trade a working automatic download for an
            // extra click. The pointer is what separates the two.
            setPointer( false );
            setShareApi( {
              canShare: () => true
            } );

            expect( shouldDeferDelivery( TWO ) ).toBe( false );
          }
        );

        it(
          "keeps the automatic download where no share sheet exists at all",
          () => {
            setPointer( true );
            setShareApi( {} );

            expect( shouldDeferDelivery( TWO ) ).toBe( false );
          }
        );
      }
    );

    describe(
      "saveArtifacts",
      () => {
        it(
          "puts every file into ONE share sheet",
          async() => {
            const share = jest.fn().mockResolvedValue( undefined );

            setShareApi( {
              share,
              canShare: () => true
            } );

            const outcome = await saveArtifacts(
              TWO,
              "braid",
              "braid-export.zip"
            );

            expect( outcome ).toBe( "shared" );
            expect( isDelivered( outcome ) ).toBe( true );

            // One call, both files. This is the whole fix: iOS offers
            // "Save 2 Videos" once, instead of two prompts racing each other.
            expect( share ).toHaveBeenCalledTimes( 1 );

            const shared = share.mock.calls[ 0 ][ 0 ] as {
              files: File[];
            };

            expect( shared.files ).toHaveLength( 2 );
            expect( triggerDownload ).not.toHaveBeenCalled();
          }
        );

        it(
          "collapses to exactly ONE download when there is no share sheet",
          async() => {
            const outcome = await saveArtifacts(
              TWO,
              "braid",
              "braid-export.zip"
            );

            expect( outcome ).toBe( "downloaded" );

            // Two artifacts, one download: the zip. Two would be the bug.
            expect( triggerDownload ).toHaveBeenCalledTimes( 1 );
            expect( triggerDownload.mock.calls[ 0 ][ 1 ] ).toBe( "braid-export.zip" );
          }
        );

        it(
          "downloads a lone artifact as itself, not wrapped in a zip",
          async() => {
            const outcome = await saveArtifacts(
              [
                TWO[ 0 ]
              ],
              "braid",
              "braid-export.zip"
            );

            expect( outcome ).toBe( "downloaded" );
            expect( triggerDownload ).toHaveBeenCalledTimes( 1 );
            expect( triggerDownload.mock.calls[ 0 ][ 1 ] ).toBe( "braid-reel-1080x1920.mp4" );
          }
        );

        it(
          "delivers nothing when the sheet is dismissed",
          async() => {
            setShareApi( {
              share: async() => {
                throw new DOMException(
                  "Share canceled",
                  "AbortError"
                );
              },
              canShare: () => true
            } );

            const outcome = await saveArtifacts(
              TWO,
              "braid",
              "braid-export.zip"
            );

            // The user looked and chose not to save. Downloading behind their
            // back is exactly the behaviour the share path exists to avoid, and
            // the files stay held so the row can offer the save again.
            expect( outcome ).toBe( "dismissed" );
            expect( isDelivered( outcome ) ).toBe( false );
            expect( triggerDownload ).not.toHaveBeenCalled();
          }
        );

        it(
          "delivers nothing while another sheet is already open",
          async() => {
            setShareApi( {
              share: async() => {
                throw new DOMException(
                  "share() is already in progress",
                  "InvalidStateError"
                );
              },
              canShare: () => true
            } );

            const outcome = await saveArtifacts(
              TWO,
              "braid",
              "braid-export.zip"
            );

            // A download here would land BEHIND the open sheet — stacking, by
            // the back door.
            expect( outcome ).toBe( "busy" );
            expect( triggerDownload ).not.toHaveBeenCalled();
          }
        );

        it(
          "falls back to one download when the sheet refuses the files",
          async() => {
            setShareApi( {
              share: async() => {
                throw new DOMException(
                  "Permission denied",
                  "NotAllowedError"
                );
              },
              canShare: () => true
            } );

            const outcome = await saveArtifacts(
              TWO,
              "braid",
              "braid-export.zip"
            );

            expect( outcome ).toBe( "downloaded" );
            expect( triggerDownload ).toHaveBeenCalledTimes( 1 );
          }
        );
      }
    );

    describe(
      "downloadArtifacts",
      () => {
        it(
          "never opens a share sheet, even where one exists",
          async() => {
            const share = jest.fn().mockResolvedValue( undefined );

            setShareApi( {
              share,
              canShare: () => true
            } );

            const outcome = await downloadArtifacts(
              TWO,
              "braid-export.zip"
            );

            // The automatic path runs minutes after the Export tap. A sheet
            // opening by itself there is not something a run may do unasked.
            expect( share ).not.toHaveBeenCalled();
            expect( outcome ).toBe( "downloaded" );
            expect( triggerDownload ).toHaveBeenCalledTimes( 1 );
          }
        );
      }
    );
  }
);
