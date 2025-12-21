/**
 * Efficiently writes a segmentation mask into a p5 Graphics buffer.
 * * @param {p5.Graphics} layer - The p5 Graphics object (should match mask size).
 * @param {Uint8Array} maskData - The raw mask from MediaPipe.
 * @param {Array<number>} color - [r, g, b, a] color.
 */
export function drawSegmentationMask(
  layer,
  maskData,
  color = [
    255,
    0,
    0,
    255
  ],
  inverse = false
) {
  if ( !maskData ) return;

  // 1. Lock the pixels for manipulation
  layer.loadPixels();

  // 2. Create a 32-bit view of the p5 pixels array
  // This lets us write 1 pixel in 1 operation instead of 4
  const pixelBuffer = new Uint32Array( layer.pixels.buffer );

  // 3. Prepare the color integer (Endian-agnostic way)
  const tempColor = new Uint8ClampedArray( color );
  const color32 = new Uint32Array( tempColor.buffer )[ 0 ];

  // 4. The Loop (Fastest part)
  let i = 0;
  // We use the smaller length to avoid bounds errors if sizes mismatch
  const len = Math.min(
    maskData.length,
    pixelBuffer.length
  );

  // Reset the buffer to empty (0) first?
  // Actually, we can just overwrite.
  // If mask[i] > 0 -> write Color.
  // If mask[i] == 0 -> write Transparent (0).
  while ( i < len ) {
    if ( maskData[ i ] > 0 ) {
      pixelBuffer[ i ] = inverse ? 0 : color32;
    } else {
      pixelBuffer[ i ] = inverse ? color32 : 0; // Clears the pixel to transparent
    }
    i++;
  }

  // 5. Push changes to GPU
  layer.updatePixels();
}
