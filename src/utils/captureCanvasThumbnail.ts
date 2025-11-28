import { Page } from "playwright";
import fs from "node:fs/promises";

/**
 * Captures a clean thumbnail from a canvas element using Canvas API
 * 
 * This function uses the Canvas API directly to extract image data:
 * 1. Waits for canvas to be loaded
 * 2. Uses canvas.toDataURL() to get image data directly from canvas
 * 3. Converts data URL to buffer and saves to file
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
  }
) {
  const { quality = 0.9, format = "jpeg" } = options ?? {};

  // Wait for canvas to be loaded
  await page.waitForSelector( "canvas#defaultCanvas0.loaded", { timeout: 30000 } );

  // Get image data directly from canvas using Canvas API
  const imageDataUrl = await page.evaluate(
    ( { format, quality } ) => {
      const canvas = document.querySelector( "canvas#defaultCanvas0" ) as HTMLCanvasElement;
      if ( !canvas ) {
        throw new Error( "Canvas element not found" );
      }

      // Use canvas.toDataURL to get image data
      const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
      return canvas.toDataURL( mimeType, quality );
    },
    { format, quality }
  );

  // Convert data URL to buffer
  const base64Data = imageDataUrl.replace( /^data:image\/\w+;base64,/, "" );
  const buffer = Buffer.from( base64Data, "base64" );

  // Save to file
  await fs.writeFile( thumbnailPath, buffer );
}
