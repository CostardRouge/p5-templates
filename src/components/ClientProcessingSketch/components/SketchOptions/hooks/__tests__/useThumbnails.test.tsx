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
// capture path resolves deterministically to a sentinel data URL. `pixels`
// feeds the uniformity check; omitted, getImageData is absent and the capture
// reports non-uniform.
function stubDestinationCanvas( pixels?: number[] ) {
  const context: Record<string, unknown> = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    drawImage: jest.fn()
  };

  if ( pixels ) {
    context.getImageData = jest.fn().mockReturnValue( {
      data: new Uint8ClampedArray( pixels )
    } );
  }

  jest
    .spyOn(
      HTMLCanvasElement.prototype,
      "getContext"
    )
    .mockReturnValue( context as unknown as CanvasRenderingContext2D );

  jest
    .spyOn(
      HTMLCanvasElement.prototype,
      "toDataURL"
    )
    .mockReturnValue( "data:image/jpeg;base64,STUB" );
}

// Two black pixels: a uniform frame, as produced by a blank WEBGL read
// flattened onto the opaque destination canvas.
const UNIFORM_PIXELS = [
  0,
  0,
  0,
  255,
  0,
  0,
  0,
  255
];

function frameCanvas(): HTMLCanvasElement {
  const canvas = document.createElement( "canvas" );

  canvas.width = 100;
  canvas.height = 125;

  return canvas;
}

/** Mount a slide-tracked live canvas so waitForSlideRendered can confirm it. */
function mountTrackedCanvas( slideIndex: number ): HTMLCanvasElement {
  const container = document.createElement( "div" );

  container.className = "sketch-canvas-container";

  const canvas = document.createElement( "canvas" );

  canvas.width = 100;
  canvas.height = 125;
  canvas.dataset.slide = String( slideIndex );
  container.appendChild( canvas );
  document.body.appendChild( container );

  return canvas;
}

afterEach( () => {
  document.body.innerHTML = "";
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

/* ------------------------------------------------------------------ */
/*  Blank-capture guard                                                */
/* ------------------------------------------------------------------ */

describe(
  "useThumbnails blank-capture guard",
  () => {
    it(
      "discards a uniform capture from an unsynchronised read",
      async() => {
        // The black-thumbnail bug: a capture fired without a slide index reads
        // the canvas mid-switch, gets a blank WEBGL buffer flattened into a
        // solid JPEG, and used to store it for good.
        stubDestinationCanvas( UNIFORM_PIXELS );

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

        expect( result.current.thumbnails.s1 ).toBeUndefined();
      }
    );

    it(
      "stores a uniform capture when the slide was confirmed rendered",
      async() => {
        // A sketch that legitimately renders a flat frame keeps an accurate
        // tile: confirmation (data-slide matched over two frames) is what
        // separates it from a failed read.
        stubDestinationCanvas( UNIFORM_PIXELS );
        mountTrackedCanvas( 0 );

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
          await result.current.captureThumbnail(
            "s1",
            0
          );
        } );

        expect( result.current.thumbnails.s1 ).toBe( "data:image/jpeg;base64,STUB" );
      }
    );

    it(
      "discards a capture when the engine is rendering another slide",
      async() => {
        // Rapid slide switches: the wait for slide 0 expires while the canvas
        // shows slide 1 — storing that frame under s1 would pin the wrong
        // artwork on the tile.
        stubDestinationCanvas();
        mountTrackedCanvas( 1 );
        jest.spyOn(
          console,
          "warn"
        ).mockImplementation( () => undefined );

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
          await result.current.captureThumbnail(
            "s1",
            0,
            {
              waitTimeoutMs: 60
            }
          );
        } );

        expect( readFrame ).not.toHaveBeenCalled();
        expect( result.current.thumbnails.s1 ).toBeUndefined();
      }
    );
  }
);
