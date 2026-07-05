/**
 * @jest-environment jsdom
 */
import {
  act, renderHook
} from "@testing-library/react";
import type {
  SketchEngine
} from "@/engines/types";
import {
  useThumbnails
} from "../useThumbnails";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeEngine( readFrame: jest.Mock ): SketchEngine {
  return {
    getCaptureSource: () => ( {
      readFrame
    } )
  } as unknown as SketchEngine;
}

// jsdom has no real 2D backend; stub the destination context + encoder so the
// capture path resolves deterministically to a sentinel data URL.
function stubDestinationCanvas() {
  jest
    .spyOn(
      HTMLCanvasElement.prototype,
      "getContext"
    )
    .mockReturnValue( {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      drawImage: jest.fn()
    } as unknown as CanvasRenderingContext2D );

  jest
    .spyOn(
      HTMLCanvasElement.prototype,
      "toDataURL"
    )
    .mockReturnValue( "data:image/jpeg;base64,STUB" );
}

function frameCanvas(): HTMLCanvasElement {
  const canvas = document.createElement( "canvas" );

  canvas.width = 100;
  canvas.height = 125;

  return canvas;
}

afterEach( () => {
  jest.restoreAllMocks();
} );

/* ------------------------------------------------------------------ */
/*  Recording gate                                                     */
/* ------------------------------------------------------------------ */

describe(
  "useThumbnails recording gate",
  () => {
    it(
      "captures from the engine when no recording is in flight",
      async() => {
        stubDestinationCanvas();

        const readFrame = jest.fn().mockResolvedValue( frameCanvas() );
        const {
          result
        } = renderHook( () => useThumbnails( {
          enabled: true,
          slideFields: [
            {
              id: "s1"
            }
          ],
          engine: makeEngine( readFrame ),
          recording: false
        } ) );

        await act( async() => {
          await result.current.captureThumbnail( "s1" );
        } );

        expect( readFrame ).toHaveBeenCalledTimes( 1 );
        expect( result.current.thumbnails.s1 ).toBe( "data:image/jpeg;base64,STUB" );
      }
    );

    it(
      "skips capture (never touches the engine) while a recording is in flight",
      async() => {
        stubDestinationCanvas();

        // If the gate leaked, this GSAP-style read would rasterise the shared
        // mirror canvas the recorder is driving.
        const readFrame = jest.fn().mockResolvedValue( frameCanvas() );
        const {
          result
        } = renderHook( () => useThumbnails( {
          enabled: true,
          slideFields: [
            {
              id: "s1"
            }
          ],
          engine: makeEngine( readFrame ),
          recording: true
        } ) );

        await act( async() => {
          await result.current.captureThumbnail( "s1" );
        } );

        expect( readFrame ).not.toHaveBeenCalled();
        expect( result.current.thumbnails.s1 ).toBeUndefined();
      }
    );
  }
);
