/**
 * Captures a thumbnail from the p5.js canvas and returns a data URL
 * Uses native Canvas API for better compatibility with Next.js/Turbopack
 */
export async function captureThumbnailFromCanvas(): Promise<string | null> {
  const canvas = document.querySelector("canvas#defaultCanvas0") as HTMLCanvasElement;

  if (!canvas) {
    return null;
  }

  try {
    // Target width for thumbnail - optimal for grid display
    const targetWidth = 240;
    const scaleFactor = targetWidth / canvas.width;
    const targetHeight = Math.round(canvas.height * scaleFactor);

    // Create destination canvas
    const destCanvas = document.createElement("canvas");
    destCanvas.width = targetWidth;
    destCanvas.height = targetHeight;

    // Get context and use native canvas resizing
    const ctx = destCanvas.getContext("2d", {
      alpha: false, // No transparency for better JPEG compression
      willReadFrequently: false,
    });

    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw the source canvas onto the destination canvas (resized)
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    // Convert to data URL (JPEG format, 85% quality)
    const dataUrl = destCanvas.toDataURL("image/jpeg", 0.85);

    return dataUrl;
  } catch (e) {
    console.error("Failed to capture thumbnail", e);
    return null;
  }
}
