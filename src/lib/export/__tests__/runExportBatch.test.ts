/**
 * @jest-environment jsdom
 */
/**
 * The runner's contract with the panel, for the branch that needs no encoder.
 *
 * Two guarantees, and the second one is the fragile one: a variant's files are
 * handed to `onArtifacts` so they can be previewed, AND they still download on
 * their own. The preview was added on top of an auto-download the user already
 * relies on, so a regression that silently replaces one with the other is the
 * failure worth a test.
 */

import {
  runExportBatch
} from "../runExportBatch";
import type {
  ExportVariant
} from "../variants";
import type {
  SketchEngine
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";

// The recording subtree pulls in the WebCodecs and gif.js encoders; the image
// path never touches it, and importing it under jsdom is pure cost.
jest.mock(
  "@/engines/recording",
  () => ( {
    createEngineHost: jest.fn(),
    createRecorder: jest.fn(),
    createSlidePlaylistHost: jest.fn()
  } )
);

const triggerDownload = jest.fn();

jest.mock(
  "../download",
  () => ( {
    ...jest.requireActual( "../download" ),
    triggerDownload: ( ...args: unknown[] ) => triggerDownload( ...args )
  } )
);

jest.mock(
  "@/lib/canvasSnapshot",
  () => ( {
    captureFreshPngBlob: async() => new Blob(
      [
        new Uint8Array( [
          137,
          80,
          78,
          71
        ] )
      ],
      {
        type: "image/png"
      }
    )
  } )
);

const OPTIONS = {
  size: {
    width: 320,
    height: 240
  },
  animation: {
    duration: 4,
    framerate: 30
  }
} as unknown as SketchOption;

function makeEngine(): SketchEngine {
  return {
    getCaptureSource: () => ( {
      width: 320,
      height: 240,
      getStreamCanvas: () => null,
      readFrame: async() => ( {} as unknown as CanvasImageSource ),
      beginRealtime: () => undefined,
      endRealtime: () => undefined
    } ),
    redraw: () => undefined
  } as unknown as SketchEngine;
}

const VARIANT: ExportVariant = {
  id: "v1",
  name: "Still",
  kind: "image",
  size: null,
  framerate: null,
  format: "mp4",
  frameCount: 10,
  slides: "current",
  delivery: "separate",
  sizeStrategy: "smallest"
};

describe(
  "runExportBatch",
  () => {
    beforeEach( () => {
      triggerDownload.mockClear();

      // `dataUrlToBlob` reads its data: URL back through fetch, which jsdom
      // does not implement.
      globalThis.fetch = jest.fn( async() => ( {
        blob: async() => new Blob(
          [
            "png"
          ],
          {
            type: "image/png"
          }
        )
      } ) ) as unknown as typeof globalThis.fetch;
    } );

    it(
      "hands a finished variant's files over AND still downloads them",
      async() => {
        const artifacts: Array<[ string, string[] ]> = [];

        const items = await runExportBatch( {
          engine: makeEngine(),
          options: OPTIONS,
          sketchName: "braid",
          activeSlideIndex: undefined,
          variants: [
            VARIANT
          ],
          onArtifacts: (
            variantId, produced
          ) => artifacts.push( [
            variantId,
            produced.map( ( artifact ) => artifact.fileName )
          ] )
        } );

        expect( items[ 0 ].status ).toBe( "done" );
        expect( artifacts ).toHaveLength( 1 );
        expect( artifacts[ 0 ][ 0 ] ).toBe( "v1" );
        expect( artifacts[ 0 ][ 1 ][ 0 ] ).toMatch( /^braid-still-320x240\.png$/ );

        // The preview is additive: the download the user is waiting on still
        // happens, and it happens for the same single file.
        expect( triggerDownload ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "reports nothing for a variant that failed",
      async() => {
        const engine = makeEngine();

        // A surface that never reaches the target: the variant fails, and a
        // failed variant must not surface artifacts to preview.
        const artifacts: string[] = [];
        const items = await runExportBatch( {
          engine,
          options: OPTIONS,
          sketchName: "braid",
          activeSlideIndex: undefined,
          variants: [
            {
              ...VARIANT,
              size: {
                width: 1080,
                height: 1920
              }
            }
          ],
          onArtifacts: ( variantId ) => artifacts.push( variantId )
        } );

        expect( items[ 0 ].status ).toBe( "failed" );
        expect( artifacts ).toEqual( [] );
        expect( triggerDownload ).not.toHaveBeenCalled();
      },
      40_000
    );
  }
);
