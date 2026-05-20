import {
  Page
} from "playwright";
import fs from "node:fs/promises";
import path from "path";
import {
  detectCaptureSurface,
  prepareCapture,
  readCaptureFrame,
  renderCaptureFrame
} from "@/utils/captureSurface";

interface CaptureFramesOptions {
  page: Page;
  framesDirectory: string;
  totalFrames: number;
  onProgress?: ( percentage: number ) => Promise<void>;
}

/**
 * Server-side frame capture using Playwright.
 * Captures each frame incrementally and writes directly to disk.
 * This method is more memory-efficient than the tar-based approach.
 *
 * Engine-agnostic: it drives whatever capture controller the active engine
 * registered (p5 canvas, GSAP/HTML DOM, …) instead of hard-coding p5.
 */
export async function captureFramesServerSide( {
  page,
  framesDirectory,
  totalFrames,
  onProgress
}: CaptureFramesOptions ): Promise<void> {
  // Ensure frames directory exists
  await fs.mkdir(
    framesDirectory,
    {
      recursive: true
    }
  );

  let lastReportedPercentage = -1;

  // Resolve the capture surface + put the engine into deterministic mode.
  const surface = await detectCaptureSurface( page );

  await prepareCapture( page );

  // Capture frames one by one
  for ( let frameIndex = 0; frameIndex < totalFrames; frameIndex++ ) {
    // Render this frame deterministically (engine controller advances time).
    await renderCaptureFrame(
      page,
      frameIndex
    );

    // Small delay to ensure frame is rendered
    await page.waitForTimeout( 10 );

    // Grab the frame (canvas pixels or DOM screenshot per engine).
    const frameBuffer = await readCaptureFrame(
      page,
      surface
    );

    // Write frame to disk with zero-padded filename
    const framePath = path.join(
      framesDirectory,
      `frame_${ String( frameIndex ).padStart(
        5,
        "0"
      ) }.png`
    );

    await fs.writeFile(
      framePath,
      frameBuffer
    );

    // Report progress
    const percentage = Math.round( ( ( frameIndex + 1 ) / totalFrames ) * 100 );

    if ( onProgress && percentage !== lastReportedPercentage ) {
      lastReportedPercentage = percentage;
      await onProgress( percentage );
    }
  }
}
