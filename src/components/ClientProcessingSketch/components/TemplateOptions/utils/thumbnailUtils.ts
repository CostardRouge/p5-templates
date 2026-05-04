/**
 * Waits for a specific slide to be rendered by checking the canvas data-slide attribute
 * This synchronizes thumbnail capture with actual slide rendering
 */
export function waitForSlideRendered(
  slideIndex: number,
  timeoutMs: number = 5000
): Promise<void> {
  return new Promise( (
    resolve, reject
  ) => {
    const startTime = Date.now();
    let matchedFrames = 0;

    const check = () => {
      const canvas = document.querySelector( "canvas.p5Canvas, canvas#defaultCanvas0" ) as HTMLCanvasElement | null;

      const dataSlide = canvas?.dataset?.slide;
      const dataSlideIndex =
        dataSlide !== undefined ? Number( dataSlide ) : undefined;

      let currentSlideIndex: number | undefined = dataSlideIndex;

      if ( currentSlideIndex === undefined ) {
        const getCurrentSlide = ( window as any )?.getCurrentSlide;

        if ( typeof getCurrentSlide === "function" ) {
          try {
            const current = getCurrentSlide();

            if ( current && typeof current.index === "number" ) {
              currentSlideIndex = current.index;
            }
          } catch {
            // ignore
          }
        }
      }

      if ( canvas && currentSlideIndex === slideIndex ) {
        matchedFrames += 1;

        // Require a couple frames so the draw loop catches up
        if ( matchedFrames >= 2 ) {
          resolve();
          return;
        }
      } else {
        matchedFrames = 0;
      }

      if ( Date.now() - startTime > timeoutMs ) {
        // Best-effort: if the canvas exists, proceed with capture.
        if ( canvas ) {
          console.warn( `[thumbnails] Timeout waiting for slide ${ slideIndex }, continuing anyway` );
          resolve();
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

/**
 * Captures a thumbnail from the p5.js canvas and returns a data URL
 * Uses native Canvas API for better compatibility with Next.js/Turbopack
 */
export async function captureThumbnailFromCanvas(): Promise<string | null> {
  const canvas = document.querySelector( "canvas.p5Canvas, canvas#defaultCanvas0" ) as HTMLCanvasElement;

  if ( !canvas ) {
    return null;
  }

  try {
    // Target width for thumbnail - optimal for grid display
    const targetWidth = 240;
    const scaleFactor = targetWidth / canvas.width;
    const targetHeight = Math.round( canvas.height * scaleFactor );

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

    return dataUrl;
  } catch ( e ) {
    console.error(
      "Failed to capture thumbnail",
      e
    );
    return null;
  }
}
