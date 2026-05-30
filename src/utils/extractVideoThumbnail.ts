import {
  spawn
} from "child_process";

/**
 * Extracts the first frame of a video file as a WebP image using FFmpeg.
 * Avoids the need to open a browser page solely for thumbnail capture.
 */
export async function extractVideoThumbnail(
  videoPath: string,
  thumbnailPath: string,
  quality = 85
): Promise<void> {
  await new Promise<void>( (
    resolve, reject
  ) => {
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-vframes",
        "1",
        "-q:v",
        String( quality ),
        thumbnailPath
      ]
    );

    let stderr = "";

    ffmpeg.stderr.on(
      "data",
      ( chunk: Buffer ) => {
        stderr += chunk.toString();
      }
    );

    ffmpeg.on(
      "close",
      ( code: number ) => {
        if ( code === 0 ) {
          resolve();
        } else {
          reject( new Error( `FFmpeg thumbnail extraction failed (code ${ code })\n${ stderr }` ) );
        }
      }
    );

    ffmpeg.on(
      "error",
      reject
    );
  } );
}
