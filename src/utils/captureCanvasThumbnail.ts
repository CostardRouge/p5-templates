import {
  Page
} from "playwright";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "path";
import {
  detectCaptureSurface, readCaptureFrame
} from "@/utils/captureSurface";

/**
 * Captures a clean thumbnail from a canvas element using Canvas API
 *
 * This function uses the Canvas API directly to extract image data:
 * 1. Waits for canvas to be loaded
 * 2. Uses canvas.toDataURL() to get image data directly from canvas
 * 3. Optionally resizes with high-quality interpolation (lanczos3)
 * 4. Saves to file
 *
 * This approach is more efficient than Playwright screenshots because:
 * - No UI elements can interfere (we get raw canvas data)
 * - Faster execution (no screenshot rendering)
 * - More reliable (direct canvas access)
 *
 * @param page - Playwright page instance
 * @param thumbnailPath - Path where the thumbnail should be saved
 * @param options - Optional configuration
 */
export async function captureCanvasThumbnail(
  page: Page,
  thumbnailPath: string,
  options?: {
    quality?: number;
    format?: "jpeg" | "png";
    resize?: {
      width?: number;
      height?: number;
      fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    };
  }
) {
  const {
    quality = 90, format = "jpeg", resize
  } = options ?? {};

  // Wait for the sketch to be ready — generic engine routes flag readiness
  // with `[data-engine-ready]`; legacy p5 routes use the loaded canvas class.
  await page.waitForSelector(
    "[data-engine-ready], canvas.p5Canvas.loaded",
    {
      timeout: 30000
    }
  );

  // Grab a PNG frame using the engine's capture surface (canvas pixels or a
  // DOM screenshot). sharp re-encodes to the requested format below.
  const surface = await detectCaptureSurface( page );
  const buffer = await readCaptureFrame(
    page,
    surface
  );

  // Ensure directory exists
  const directory = path.dirname( thumbnailPath );

  await fs.mkdir(
    directory,
    {
      recursive: true
    }
  );

  // Process image with sharp
  let sharpInstance = sharp( buffer );

  // Apply resize if specified
  if ( resize ) {
    sharpInstance = sharpInstance.resize( {
      width: resize.width,
      height: resize.height,
      fit: resize.fit ?? "cover",
      kernel: sharp.kernel.lanczos3 // High-quality interpolation, no aliasing
    } );
  }

  // Save to file with appropriate format
  if ( format === "jpeg" ) {
    await sharpInstance
      .jpeg( {
        quality
      } )
      .toFile( thumbnailPath );
  } else {
    await sharpInstance
      .png( {
        quality
      } )
      .toFile( thumbnailPath );
  }
}
