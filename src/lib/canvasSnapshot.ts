import {
  artifactToFile, shareFiles, type ShareOutcome
} from "@/lib/export/share";
import type {
  SketchEngine
} from "@/engines/types";

/**
 * Read the current frame off the engine's capture surface.
 *
 * Goes through the capture source rather than `getCanvas()`, so DOM engines
 * (GSAP / HTML) re-rasterise the live DOM on demand: their mirror canvas is
 * only refreshed on redraw, and reading it straight during playback yields a
 * stale — or blank — frame. The live canvas is the fallback.
 */
async function readSurface( engine: SketchEngine | null | undefined ): Promise<HTMLCanvasElement | null> {
  if ( !engine ) {
    return null;
  }

  try {
    const frame = await engine.getCaptureSource().readFrame();

    if ( frame instanceof HTMLCanvasElement ) {
      return frame;
    }
  } catch {
    // Fall through to the live canvas below.
  }

  return engine.getCanvas();
}

/**
 * Grab the current frame as a PNG blob.
 *
 * Prefer this over `captureFreshPng` everywhere the pixels are destined for a
 * file: a 1080x1350 frame is a ~1.5MB data URL, and every hop that carries one
 * (an `<a href>`, a `fetch()` back into a blob) is a size limit waiting to be
 * hit. `toBlob` produces the bytes directly.
 */
export async function captureFreshPngBlob( engine: SketchEngine | null | undefined ): Promise<Blob | null> {
  const canvas = await readSurface( engine );

  if ( !canvas ) {
    return null;
  }

  return new Promise( ( resolve ) => {
    try {
      canvas.toBlob(
        ( blob ) => resolve( blob ),
        "image/png"
      );
    } catch {
      resolve( null );
    }
  } );
}

/**
 * Grab the current frame as a PNG data URL.
 *
 * Only for the consumers that genuinely need base64 — the dev thumbnail route
 * posts the string as JSON. Anything producing a file wants
 * `captureFreshPngBlob` instead.
 */
export async function captureFreshPng( engine: SketchEngine | null | undefined ): Promise<string | null> {
  const canvas = await readSurface( engine );

  return canvas ? canvas.toDataURL( "image/png" ) : null;
}

/**
 * Capture the current frame and hand it to the user.
 *
 * Through the share sheet where the browser offers one, a download otherwise —
 * the same route every other export takes (`src/lib/export/share.ts`), and for
 * the same reason: on iOS an `<a download>` only ever reaches the Files app,
 * and "Save Image" in the share sheet is the only way into Photos.
 *
 * This used to click an `<a href="data:image/png;base64,…">` that was never
 * added to the document. Desktop browsers tolerate both of those; mobile
 * Safari acts on neither, so the button did nothing at all there.
 */
export async function downloadCanvasPng(
  engine: SketchEngine | null | undefined,
  fileName: string
): Promise<ShareOutcome | null> {
  const blob = await captureFreshPngBlob( engine );

  if ( !blob ) {
    return null;
  }

  return shareFiles(
    [
      artifactToFile(
        blob,
        `${ fileName }.png`
      )
    ],
    fileName
  );
}
