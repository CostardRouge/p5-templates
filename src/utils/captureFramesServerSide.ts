import { Page } from "playwright";
import fs from "node:fs/promises";
import path from "path";

interface CaptureFramesOptions {
  page: Page;
  framesDirectory: string;
  totalFrames: number;
  onProgress?: (percentage: number) => Promise<void>;
}

/**
 * Server-side frame capture using Playwright.
 * Captures each frame incrementally and writes directly to disk.
 * This method is more memory-efficient than the tar-based approach.
 */
export async function captureFramesServerSide({
  page,
  framesDirectory,
  totalFrames,
  onProgress,
}: CaptureFramesOptions): Promise<void> {
  // Ensure frames directory exists
  await fs.mkdir(framesDirectory, { recursive: true });

  let lastReportedPercentage = -1;

  // Initialize the sketch for frame-by-frame capture
  await page.evaluate(() => {
    // Stop the normal animation loop
    // @ts-ignore - p5.js global function
    if (typeof window.noLoop === "function") {
      // @ts-ignore
      window.noLoop();
    }
    // Enable recording mode (resets time and enables frame-based timing)
    // @ts-ignore - global function exposed by time utility
    if (typeof window.enableRecordingMode === "function") {
      // @ts-ignore
      window.enableRecordingMode();
    }
  });

  // Capture frames one by one
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    // Trigger a single frame draw (time advances automatically via incrementElapsedTime)
    await page.evaluate(() => {
      // @ts-ignore - p5.js global function
      if (typeof window.redraw === "function") {
        // @ts-ignore
        window.redraw();
      }
    });

    // Small delay to ensure frame is rendered
    await page.waitForTimeout(10);

    // Get the canvas element and extract frame data
    const frameDataUrl = await page.evaluate(() => {
      const canvas = document.querySelector("canvas#defaultCanvas0") as HTMLCanvasElement;
      if (!canvas) {
        throw new Error("Canvas element not found");
      }
      return canvas.toDataURL("image/png");
    });

    // Decode base64 to buffer
    const base64Data = frameDataUrl.replace(/^data:image\/png;base64,/, "");
    const frameBuffer = Buffer.from(base64Data, "base64");

    // Write frame to disk with zero-padded filename
    const framePath = path.join(
      framesDirectory,
      `frame_${String(frameIndex).padStart(5, "0")}.png`
    );
    await fs.writeFile(framePath, frameBuffer);

    // Report progress
    const percentage = Math.round(((frameIndex + 1) / totalFrames) * 100);
    if (onProgress && percentage !== lastReportedPercentage) {
      lastReportedPercentage = percentage;
      await onProgress(percentage);
    }
  }
}
