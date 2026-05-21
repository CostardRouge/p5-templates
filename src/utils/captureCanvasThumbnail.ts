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
type ThumbnailFormat = "jpeg" | "png" | "webp";

type ResizeOptions = {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
};

export async function captureCanvasThumbnail(
  page: Page,
  thumbnailPath: string,
  options?: {
    quality?: number;
    format?: ThumbnailFormat;
    resize?: ResizeOptions;
  }
) {
  const {
    quality = 90, format = "jpeg", resize
  } = options ?? {};

  const buffer = await captureCanvasBuffer( page );

  await writeThumbnail(
    buffer,
    thumbnailPath,
    {
      format,
      quality,
      resize
    }
  );
}

/**
 * Capture a raw PNG frame from the current sketch's canvas. Use this when you
 * need to write multiple variants (e.g. 1x + 2x) from a single render.
 */
export async function captureCanvasBuffer( page: Page ): Promise<Buffer> {
  // Wait for the sketch to be ready — generic engine routes flag readiness
  // with `[data-engine-ready]`; legacy p5 routes use the loaded canvas class.
  await page.waitForSelector(
    "[data-engine-ready], canvas.p5Canvas.loaded",
    {
      timeout: 30000
    }
  );

  const surface = await detectCaptureSurface( page );

  return readCaptureFrame(
    page,
    surface
  );
}

/**
 * Encode a previously captured buffer to disk in the requested format. The
 * directory is created if missing.
 */
export async function writeThumbnail(
  buffer: Buffer,
  thumbnailPath: string,
  options: {
    format: ThumbnailFormat;
    quality?: number;
    resize?: ResizeOptions;
  }
) {
  const {
    format, quality = 90, resize
  } = options;

  await fs.mkdir(
    path.dirname( thumbnailPath ),
    {
      recursive: true
    }
  );

  let sharpInstance = sharp( buffer );

  if ( resize ) {
    sharpInstance = sharpInstance.resize( {
      width: resize.width,
      height: resize.height,
      fit: resize.fit ?? "cover",
      kernel: sharp.kernel.lanczos3
    } );
  }

  if ( format === "jpeg" ) {
    await sharpInstance.jpeg( {
      quality
    } ).toFile( thumbnailPath );
  } else if ( format === "webp" ) {
    await sharpInstance.webp( {
      quality
    } ).toFile( thumbnailPath );
  } else {
    await sharpInstance.png( {
      quality
    } ).toFile( thumbnailPath );
  }
}
