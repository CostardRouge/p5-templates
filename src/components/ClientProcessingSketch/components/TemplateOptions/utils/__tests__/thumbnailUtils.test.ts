/**
 * @jest-environment jsdom
 */
import {
  getActiveSketchCanvas,
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

afterEach( () => {
  document.body.innerHTML = "";
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
  }
);
