/**
 * @jest-environment jsdom
 */

import {
  artifactToFile, canShareFiles, shareFiles
} from "../share";

const originalShare = navigator.share;
const originalCanShare = navigator.canShare;

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

function makeFile(): File {
  return artifactToFile(
    new Blob(
      [
        "x"
      ],
      {
        type: "image/png"
      }
    ),
    "sketch-1080x1350.png"
  );
}

describe(
  "share",
  () => {
    beforeEach( () => {
      // jsdom implements neither of these: the download fallback goes through
      // an object URL and a synthetic anchor click, so both are stubbed to let
      // the branch run.
      HTMLAnchorElement.prototype.click = jest.fn();
      URL.createObjectURL = jest.fn( () => "blob:test" );
      URL.revokeObjectURL = jest.fn();
    } );

    afterEach( () => {
      setShareApi( {
        share: originalShare,
        canShare: originalCanShare
      } );
    } );

    it(
      "reports no sharing where the API is absent, which is every desktop browser today",
      () => {
        setShareApi( {} );

        expect( canShareFiles( [
          makeFile()
        ] ) ).toBe( false );
      }
    );

    it(
      "never claims to share nothing",
      () => {
        setShareApi( {
          canShare: () => true
        } );

        expect( canShareFiles( [] ) ).toBe( false );
      }
    );

    it(
      "treats a throwing canShare as a no, since some engines throw on an unsupported type",
      () => {
        setShareApi( {
          canShare: () => {
            throw new Error( "nope" );
          }
        } );

        expect( canShareFiles( [
          makeFile()
        ] ) ).toBe( false );
      }
    );

    it(
      "downloads when the platform cannot share",
      async() => {
        setShareApi( {} );

        await expect( shareFiles(
          [
            makeFile()
          ],
          "Export"
        ) ).resolves.toBe( "downloaded" );
      }
    );

    it(
      "reports a dismissed sheet as dismissed, and does NOT download behind the user's back",
      async() => {
        // The user looked and chose not to save. Re-triggering a download for
        // them is exactly the behaviour this feature exists to avoid.
        const share = jest.fn().mockRejectedValue( new DOMException(
          "cancelled",
          "AbortError"
        ) );

        setShareApi( {
          canShare: () => true,
          share
        } );

        await expect( shareFiles(
          [
            makeFile()
          ],
          "Export"
        ) ).resolves.toBe( "dismissed" );
        expect( HTMLAnchorElement.prototype.click ).not.toHaveBeenCalled();
      }
    );

    it(
      "falls back to a download when the share fails for any other reason",
      async() => {
        const share = jest.fn().mockRejectedValue( new Error( "not allowed" ) );

        setShareApi( {
          canShare: () => true,
          share
        } );

        await expect( shareFiles(
          [
            makeFile()
          ],
          "Export"
        ) ).resolves.toBe( "downloaded" );
        expect( HTMLAnchorElement.prototype.click ).toHaveBeenCalled();
      }
    );

    it(
      "shares when the platform accepts the files",
      async() => {
        const share = jest.fn().mockResolvedValue( undefined );

        setShareApi( {
          canShare: () => true,
          share
        } );

        await expect( shareFiles(
          [
            makeFile()
          ],
          "Export"
        ) ).resolves.toBe( "shared" );
        expect( share ).toHaveBeenCalled();
      }
    );

    it(
      "carries the blob's own type onto the File, which is what the sheet routes on",
      () => {
        const file = makeFile();

        expect( file.type ).toBe( "image/png" );
        expect( file.name ).toBe( "sketch-1080x1350.png" );
      }
    );
  }
);
