import pica from "pica";

/**
 * Captures a thumbnail from the p5.js canvas and returns a data URL
 */
export async function captureThumbnailFromCanvas(
  picaInstance: ReturnType<typeof pica>
): Promise<string | null> {
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

    // Use pica for high-quality resizing
    await picaInstance.resize(canvas, destCanvas, {
      quality: 3, // High quality (0-3)
      unsharpAmount: 80,
      unsharpRadius: 0.6,
      unsharpThreshold: 2,
    });

    // Convert to JPEG blob
    const blob = await picaInstance.toBlob(destCanvas, "image/jpeg", 0.85);

    // Convert blob to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to capture thumbnail", e);
    return null;
  }
}
