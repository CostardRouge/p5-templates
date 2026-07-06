/**
 * @jest-environment jsdom
 */
import type {
  SketchEngine
} from "@/engines/types";
import {
  captureThumbnailFromCanvas,
  getActiveSketchCanvas,
  getCurrentFrameCanvas,
  waitForSlideRendered
} from "../thumbnailUtils";

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

function mountCanvasInContainer( className: string ): HTMLCanvasElement {
  const container = document.createElement( "div" );

  container.className = "sketch-canvas-container";

  const canvas = document.createElement( "canvas" );

  canvas.className = className;
  container.appendChild( canvas );
  document.body.appendChild( container );

  return canvas;
}

function makeCanvas(
  width: number, height: number
): HTMLCanvasElement {
  const canvas = document.createElement( "canvas" );

  canvas.width = width;
  canvas.height = height;

  return canvas;
}

/** Minimal engine stub exposing only the capture source used by these utils. */
function makeEngine( readFrame: () => Promise<CanvasImageSource> ): SketchEngine {
  return {
    getCaptureSource: () => ( {
      readFrame
    } )
  } as unknown as SketchEngine;
}

afterEach( () => {
  document.body.innerHTML = "";
  jest.restoreAllMocks();
} );

/* ------------------------------------------------------------------ */
/*  getActiveSketchCanvas                                              */
/* ------------------------------------------------------------------ */

describe(
  "getActiveSketchCanvas",
  () => {
    it(
      "resolves the p5 canvas mounted in the preview container",
      () => {
        const canvas = mountCanvasInContainer( "p5Canvas" );

        expect( getActiveSketchCanvas() ).toBe( canvas );
      }
    );

    it(
      "resolves the Three.js canvas mounted in the preview container",
      () => {
        // The bug: the Three.js canvas is tagged `threejs-canvas`, not
        // `p5Canvas`, so the old p5-only selector never found it.
        const canvas = mountCanvasInContainer( "threejs-canvas" );

        expect( getActiveSketchCanvas() ).toBe( canvas );
      }
    );

    it(
      "falls back to the legacy p5 selector when no container is present",
      () => {
        const canvas = document.createElement( "canvas" );

        canvas.className = "p5Canvas";
        document.body.appendChild( canvas );

        expect( getActiveSketchCanvas() ).toBe( canvas );
      }
    );

    it(
      "returns null when no sketch canvas exists",
      () => {
        expect( getActiveSketchCanvas() ).toBeNull();
      }
    );
  }
);

/* ------------------------------------------------------------------ */
/*  waitForSlideRendered                                              */
/* ------------------------------------------------------------------ */

describe(
  "waitForSlideRendered",
  () => {
    it(
      "resolves once a slide-tracked (p5) canvas reports the target slide",
      async() => {
        const canvas = mountCanvasInContainer( "p5Canvas" );

        canvas.dataset.slide = "2";

        await expect( waitForSlideRendered(
          2,
          1000
        ) ).resolves.toBeUndefined();
      }
    );

    it(
      "resolves for an engine that does not track slides (Three.js) without waiting for the timeout",
      async() => {
        mountCanvasInContainer( "threejs-canvas" );

        // No data-slide, no window.getCurrentSlide → best-effort resolve as
        // soon as the canvas is up, rather than spinning until timeoutMs.
        await expect( waitForSlideRendered(
          0,
          1000
        ) ).resolves.toBeUndefined();
      }
    );

    it(
      "rejects when no canvas ever appears",
      async() => {
        await expect( waitForSlideRendered(
          0,
          80
        ) ).rejects.toThrow( /Timeout waiting for slide/ );
      }
    );

    it(
      "resolves for GSAP: data-slide lives on the stage, the canvas is an untracked mirror",
      async() => {
        // GSAP mounts a hidden mirror canvas in the container and puts
        // `data-slide` on the stage div (not the canvas), so the canvas reads
        // as untracked and resolves best-effort once present.
        const container = document.createElement( "div" );

        container.className = "sketch-canvas-container";

        const stage = document.createElement( "div" );

        stage.className = "gsap-stage";
        stage.dataset.slide = "0";

        const mirror = document.createElement( "canvas" );

        mirror.className = "gsap-mirror-canvas";
        container.append(
          stage,
          mirror
        );
        document.body.appendChild( container );

        await expect( waitForSlideRendered(
          1,
          1000
        ) ).resolves.toBeUndefined();
      }
    );
  }
);

/* ------------------------------------------------------------------ */
/*  getCurrentFrameCanvas                                             */
/* ------------------------------------------------------------------ */

describe(
  "getCurrentFrameCanvas",
  () => {
    it(
      "returns the engine's freshly read frame, preferring it over any DOM canvas",
      async() => {
        // A stale mirror is in the DOM; the engine hands back a fresh frame.
        // Preferring the engine read is exactly what makes GSAP thumbnails
        // reflect the current frame instead of the mount-time still.
        mountCanvasInContainer( "gsap-mirror-canvas" );

        const fresh = makeCanvas(
          10,
          10
        );
        const readFrame = jest.fn().mockResolvedValue( fresh );

        await expect( getCurrentFrameCanvas( makeEngine( readFrame ) ) ).resolves.toBe( fresh );
        expect( readFrame ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "falls back to the DOM canvas when the engine read throws",
      async() => {
        const domCanvas = mountCanvasInContainer( "p5Canvas" );
        const readFrame = jest.fn().mockRejectedValue( new Error( "not ready" ) );

        await expect( getCurrentFrameCanvas( makeEngine( readFrame ) ) ).resolves.toBe( domCanvas );
      }
    );

    it(
      "falls back to the DOM canvas when no engine is supplied",
      async() => {
        const domCanvas = mountCanvasInContainer( "p5Canvas" );

        await expect( getCurrentFrameCanvas( null ) ).resolves.toBe( domCanvas );
      }
    );
  }
);

/* ------------------------------------------------------------------ */
/*  captureThumbnailFromCanvas                                        */
/* ------------------------------------------------------------------ */

describe(
  "captureThumbnailFromCanvas",
  () => {
    // jsdom has no real 2D backend, so stub the destination context + encoder
    // to exercise the source-selection + scaling logic deterministically.
    function stubDestinationCanvas() {
      const drawImage = jest.fn();

      jest
        .spyOn(
          HTMLCanvasElement.prototype,
          "getContext"
        )
        .mockReturnValue( {
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "low",
          drawImage
        } as unknown as CanvasRenderingContext2D );

      jest
        .spyOn(
          HTMLCanvasElement.prototype,
          "toDataURL"
        )
        .mockReturnValue( "data:image/jpeg;base64,STUB" );

      return {
        drawImage
      };
    }

    it(
      "captures from the engine's current frame (GSAP rasterisation path)",
      async() => {
        const {
          drawImage
        } = stubDestinationCanvas();
        const frame = makeCanvas(
          1080,
          1350
        );
        const readFrame = jest.fn().mockResolvedValue( frame );

        const dataUrl = await captureThumbnailFromCanvas( makeEngine( readFrame ) );

        expect( dataUrl ).toBe( "data:image/jpeg;base64,STUB" );
        expect( readFrame ).toHaveBeenCalledTimes( 1 );
        // Source frame is the engine's, scaled to a 240px-wide thumbnail.
        expect( drawImage ).toHaveBeenCalledWith(
          frame,
          0,
          0,
          240,
          300
        );
      }
    );

    it(
      "captures from the live DOM canvas when no engine is supplied",
      async() => {
        stubDestinationCanvas();

        const domCanvas = mountCanvasInContainer( "p5Canvas" );

        domCanvas.width = 240;
        domCanvas.height = 240;

        await expect( captureThumbnailFromCanvas() ).resolves.toBe( "data:image/jpeg;base64,STUB" );
      }
    );

    it(
      "returns null when there is no frame source at all",
      async() => {
        await expect( captureThumbnailFromCanvas() ).resolves.toBeNull();
      }
    );

    it(
      "returns null when the source frame has no dimensions",
      async() => {
        const readFrame = jest.fn().mockResolvedValue( makeCanvas(
          0,
          0
        ) );

        await expect( captureThumbnailFromCanvas( makeEngine( readFrame ) ) ).resolves.toBeNull();
      }
    );
  }
);
