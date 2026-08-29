import type {
  SketchEngine
} from "@/engines/types";

/**
 * Grab the current frame as a PNG data URL.
 *
 * Reads through the engine's capture source rather than `getCanvas()`, so DOM
 * engines (GSAP / HTML) re-rasterise the live DOM on demand: their mirror
 * canvas is only refreshed on redraw, and reading it straight during playback
 * yields a stale — or blank — frame. The live canvas is the fallback.
 */
export async function captureFreshPng( engine: SketchEngine | null | undefined ): Promise<string | null> {
  if ( !engine ) {
    return null;
  }

  try {
    const frame = await engine.getCaptureSource().readFrame();

    if ( frame instanceof HTMLCanvasElement ) {
      return frame.toDataURL( "image/png" );
    }
  } catch {
    // Fall through to the live canvas below.
  }

  const canvas = engine.getCanvas();

  return canvas ? canvas.toDataURL( "image/png" ) : null;
}

/** Capture the current frame and hand it to the browser as a download. */
export async function downloadCanvasPng(
  engine: SketchEngine | null | undefined,
  fileName: string
): Promise<boolean> {
  const dataUrl = await captureFreshPng( engine );

  if ( !dataUrl ) {
    return false;
  }

  const link = document.createElement( "a" );

  link.download = `${ fileName }.png`;
  link.href = dataUrl;
  link.click();

  return true;
}
