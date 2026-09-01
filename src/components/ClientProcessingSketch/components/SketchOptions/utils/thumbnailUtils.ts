import type {
  SketchEngine
} from "@/engines/types";

/**
 * Resolve the live sketch canvas rendered in the main preview, independent of
 * which engine produced it. p5 tags its canvas `p5Canvas`, Three.js tags its
 * WebGL canvas `threejs-canvas` — rather than hard-coding a per-engine class we
 * scope to the shared preview container (`EngineSketchRenderer`), which also
 * covers any future canvas engine. Falls back to the legacy p5 selector for
 * routes that don't mount inside the container.
 *
 * Note: for a DOM engine (GSAP) this returns the hidden mirror canvas, whose
 * pixels are only refreshed on demand — prefer `getCurrentFrameCanvas(engine)`
 * when a *current* frame is needed.
 */
export function getActiveSketchCanvas(): HTMLCanvasElement | null {
  return (
    document.querySelector<HTMLCanvasElement>( ".sketch-canvas-container canvas" ) ??
    document.querySelector<HTMLCanvasElement>( "canvas.p5Canvas" )
  );
}

/**
 * Obtain a canvas holding the engine's *current* frame, engine-agnostically.
 *
 * Canvas engines (p5, Three.js) paint straight into a live `<canvas>`, so the
 * engine's capture source hands it back as-is. GSAP renders to the DOM and has
 * no live canvas — its capture source rasterises the current stage into a
 * mirror canvas on read. Going through the engine (rather than a blind DOM
 * query) is therefore what makes GSAP thumbnails reflect the current frame
 * instead of the stale one primed at mount.
 *
 * Falls back to the DOM lookup when no engine is available (or its read fails),
 * preserving the legacy behaviour for canvas engines.
 */
export async function getCurrentFrameCanvas( engine?: SketchEngine | null ): Promise<CanvasImageSource | null> {
  if ( engine ) {
    try {
      return await engine.getCaptureSource().readFrame();
    } catch {
      // Fall through to the DOM lookup below (e.g. capture source not ready).
    }
  }

  return getActiveSketchCanvas();
}

/**
 * Which slide the sketch is rendering right now, when the engine reports it:
 * p5 slide sketches stamp `data-slide` on their canvas and expose
 * `window.getCurrentSlide`. Engines that track neither (Three.js, single-slide
 * sketches, the GSAP mirror canvas) return `undefined` — "untracked".
 */
export function getRenderedSlideIndex(): number | undefined {
  const canvas = getActiveSketchCanvas();
  const dataSlide = canvas?.dataset?.slide;

  if ( dataSlide !== undefined ) {
    return Number( dataSlide );
  }

  const getCurrentSlide = ( window as any )?.getCurrentSlide;

  if ( typeof getCurrentSlide === "function" ) {
    try {
      const current = getCurrentSlide();

      if ( current && typeof current.index === "number" ) {
        return current.index;
      }
    } catch {
      // ignore
    }
  }

  return undefined;
}

/**
 * Waits for a specific slide to be rendered by checking the canvas data-slide attribute
 * This synchronizes thumbnail capture with actual slide rendering.
 *
 * Resolves `"matched"` when the target slide was confirmed rendered for a
 * couple of frames (or the engine doesn't track slides and the canvas is up),
 * `"timeout"` when the wait expired with a canvas present, and rejects only
 * when no canvas ever appears. Because it resolves from inside a
 * `requestAnimationFrame` callback, a capture chained on it reads the canvas
 * within the same frame as the engine's draw — the only read that reliably
 * sees pixels on a WEBGL canvas without `preserveDrawingBuffer`.
 */
export type SlideWaitResult = "matched" | "timeout";

export function waitForSlideRendered(
  slideIndex: number,
  timeoutMs: number = 5000
): Promise<SlideWaitResult> {
  return new Promise( (
    resolve, reject
  ) => {
    const startTime = Date.now();
    let matchedFrames = 0;

    const check = () => {
      const canvas = getActiveSketchCanvas();
      const currentSlideIndex = getRenderedSlideIndex();

      // Engines that don't report a current slide (e.g. Three.js, or a
      // single-slide p5 sketch) can't be synchronised against `slideIndex`;
      // once their canvas is up we consider the target rendered.
      const slideTracked = currentSlideIndex !== undefined;
      const slideMatched = !slideTracked || currentSlideIndex === slideIndex;

      if ( canvas && slideMatched ) {
        matchedFrames += 1;

        // Require a couple frames so the draw loop catches up
        if ( matchedFrames >= 2 ) {
          resolve( "matched" );
          return;
        }
      } else {
        matchedFrames = 0;
      }

      if ( Date.now() - startTime > timeoutMs ) {
        // Best-effort: if the canvas exists, proceed with capture.
        if ( canvas ) {
          console.warn( `[thumbnails] Timeout waiting for slide ${ slideIndex }, continuing anyway` );
          resolve( "timeout" );
          return;
        }

        reject( new Error( `Timeout waiting for slide ${ slideIndex } to render` ) );
        return;
      }

      requestAnimationFrame( check );
    };

    check();
  } );
}

export type ThumbnailCapture = {
  dataUrl: string;
  // Every sampled pixel is identical. Either the sketch genuinely renders a
  // flat frame, or the read failed silently — a WEBGL canvas read outside the
  // draw loop hands back an empty buffer that the opaque destination flattens
  // into a valid-looking solid JPEG. The caller decides which it is from how
  // synchronised the capture was.
  isUniform: boolean;
};

/**
 * True when every sampled pixel of `canvas` is identical. Sampling reads the
 * full buffer once with an early exit on the first differing pixel, so the
 * common (non-uniform) case is cheap. Environments without a real 2D backend
 * (jsdom) report `false` — the safe default, since "uniform" is what gets a
 * capture discarded.
 */
function isCanvasUniform( canvas: HTMLCanvasElement ): boolean {
  try {
    const ctx = canvas.getContext( "2d" );

    if ( !ctx || typeof ctx.getImageData !== "function" ) {
      return false;
    }

    const {
      data
    } = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    if ( data.length < 4 ) {
      return false;
    }

    const [
      r,
      g,
      b
    ] = data;

    for ( let i = 4; i < data.length; i += 4 ) {
      if ( data[ i ] !== r || data[ i + 1 ] !== g || data[ i + 2 ] !== b ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Captures a thumbnail from the active sketch's current frame and returns a
 * JPEG data URL plus a uniformity flag. Works for every engine: `engine` is
 * used to obtain a current-frame canvas (rasterising the DOM for GSAP),
 * falling back to a live canvas lookup when no engine is supplied.
 * Uses native Canvas API for better compatibility with Next.js/Turbopack.
 */
export async function captureThumbnailFromCanvas( engine?: SketchEngine | null ): Promise<ThumbnailCapture | null> {
  const canvas = await getCurrentFrameCanvas( engine );

  const sourceWidth = ( canvas as HTMLCanvasElement | null )?.width ?? 0;
  const sourceHeight = ( canvas as HTMLCanvasElement | null )?.height ?? 0;

  if ( !canvas || !sourceWidth || !sourceHeight ) {
    return null;
  }

  try {
    // Target width for thumbnail - optimal for grid display
    const targetWidth = 240;
    const scaleFactor = targetWidth / sourceWidth;
    const targetHeight = Math.round( sourceHeight * scaleFactor );

    // Create destination canvas
    const destCanvas = document.createElement( "canvas" );

    destCanvas.width = targetWidth;
    destCanvas.height = targetHeight;

    // Get context and use native canvas resizing
    const ctx = destCanvas.getContext(
      "2d",
      {
        alpha: false, // No transparency for better JPEG compression
        willReadFrequently: false
      }
    );

    if ( !ctx ) {
      throw new Error( "Failed to get 2D context" );
    }

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw the source canvas onto the destination canvas (resized)
    ctx.drawImage(
      canvas,
      0,
      0,
      targetWidth,
      targetHeight
    );

    // Convert to data URL (JPEG format, 85% quality)
    const dataUrl = destCanvas.toDataURL(
      "image/jpeg",
      0.85
    );

    return {
      dataUrl,
      isUniform: isCanvasUniform( destCanvas )
    };
  } catch( e ) {
    console.error(
      "Failed to capture thumbnail",
      e
    );
    return null;
  }
}
