import path from "path";
import fs from "node:fs/promises";
import sharp from "sharp";

/**
 * Extract the first frame from a directory of frames and convert it to a low-res thumbnail
 * @param framesDirectory - Directory containing frame files
 * @param outputPath - Where to save the thumbnail
 * @param maxWidth - Maximum width for the thumbnail (default: 320px)
 */
export default async function captureFirstFrame(
  framesDirectory: string,
  outputPath: string,
  maxWidth: number = 320
): Promise<void> {
  const files = await fs.readdir( framesDirectory );

  // Sort to get the first frame (usually frame_0000.png or similar)
  const frameFiles = files.filter( ( f ) => f.match( /\.(png|jpg|jpeg)$/i ) ).sort();

  if ( frameFiles.length === 0 ) {
    throw new Error( `No frames found in ${ framesDirectory }` );
  }

  const firstFramePath = path.join(
    framesDirectory,
    frameFiles[ 0 ]
  );

  // Resize to thumbnail size and compress
  await sharp( firstFramePath )
    .resize(
      maxWidth,
      null,
      {
        fit: "inside",
        withoutEnlargement: true
      }
    )
    .jpeg( {
      quality: 80
    } )
    .toFile( outputPath );
}
