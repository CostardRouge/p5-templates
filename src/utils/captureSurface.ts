import {
  Page
} from "playwright";
import type {
  ServerCaptureKind
} from "@/engines/recording/types";

/**
 * Engine-agnostic headless capture helpers.
 *
 * The recording pipeline used to assume every sketch rendered into
 * `canvas.p5Canvas` and stepped via p5 globals. Instead it now talks to the
 * controller each engine registers on `window.__sketchCapture`
 * (see `@/engines/recording/serverCapture`), falling back to the legacy p5
 * behaviour when no controller is present.
 *
 * Canvas engines (p5) are read fast via `canvas.toDataURL()`; DOM/CSS engines
 * (GSAP/HTML) are captured with a Playwright element screenshot, which renders
 * the real DOM in headless Chromium.
 */
export type CaptureSurfaceInfo = {
  kind: ServerCaptureKind;
  selector: string;
};

const LEGACY_CANVAS_SELECTOR = "canvas.p5Canvas";

/** Resolve how (and from which element) frames should be grabbed. */
export async function detectCaptureSurface( page: Page ): Promise<CaptureSurfaceInfo> {
  return page.evaluate(
    ( fallbackSelector ) => {
      const controller = window.__sketchCapture;

      if ( controller?.surfaceSelector ) {
        return {
          kind: controller.captureKind ?? "canvas",
          selector: controller.surfaceSelector
        };
      }

      return {
        kind: "canvas" as const,
        selector: fallbackSelector
      };
    },
    LEGACY_CANVAS_SELECTOR
  );
}

/** Put the active engine into deterministic, frame-stepped capture mode. */
export async function prepareCapture( page: Page ): Promise<void> {
  // Let the interaction layer's vision pipeline warm up before we freeze the
  // timeline: load the video/image source, compile the first inference, emit a
  // first result. Otherwise the recording frame-steps from frame 0 while the
  // source is still loading and captures the "preparing vision" pre-roll for
  // the whole clip. The gate resolves true when ready, when no vision is
  // needed, or after its own safety deadline; the catch keeps a stuck gate
  // from failing the whole job (it just proceeds, as before).
  await page
    .waitForFunction(
      () => {
        const ready = window.isInteractionVisionReady;

        return typeof ready !== "function" || ready() === true;
      },
      undefined,
      {
        timeout: 20000,
        polling: 100
      }
    )
    .catch( () => {} );

  await page.evaluate( () => {
    // Sound-producing sketches register an audio bridge; switch it to
    // capture mode so triggers are logged against the deterministic
    // timeline instead of played. The log is rendered offline + muxed
    // after the frame loop (see muxSketchAudio).
    window.__sketchAudio?.beginCapture();

    const controller = window.__sketchCapture;

    if ( controller?.prepare ) {
      controller.prepare();
      return;
    }

    // Legacy p5 fallback (instance not driven by a controller).
    if ( typeof window.noLoop === "function" ) {
      window.noLoop();
    }

    if ( typeof window.enableRecordingMode === "function" ) {
      window.enableRecordingMode();
    }
  } );
}

/** Render a single deterministic frame in the page. */
export async function renderCaptureFrame(
  page: Page,
  frameIndex: number
): Promise<void> {
  await page.evaluate(
    async( index ) => {
      const controller = window.__sketchCapture;

      if ( controller?.renderFrame ) {
        await controller.renderFrame( index );
        return;
      }

      if ( typeof window.redraw === "function" ) {
        window.redraw();
      }
    },
    frameIndex
  );
}

/** Grab the current frame as a PNG buffer using the right strategy. */
export async function readCaptureFrame(
  page: Page,
  info: CaptureSurfaceInfo
): Promise<Buffer> {
  if ( info.kind === "dom" ) {
    const element = await page.$( info.selector );

    if ( !element ) {
      throw new Error( `Capture surface "${ info.selector }" not found.` );
    }

    return element.screenshot( {
      type: "png"
    } );
  }

  const dataUrl = await page.evaluate(
    ( selector ) => {
      const canvas = document.querySelector( selector ) as HTMLCanvasElement | null;

      if ( !canvas ) {
        throw new Error( "Canvas element not found" );
      }

      return canvas.toDataURL( "image/png" );
    },
    info.selector
  );

  const base64Data = dataUrl.replace(
    /^data:image\/png;base64,/,
    ""
  );

  return Buffer.from(
    base64Data,
    "base64"
  );
}
