import {
  spawn
} from "child_process";
import fs from "node:fs/promises"; // Add this import if not already present

async function encodeVideoFromFrames(
  framesDirectory: string,
  outputVideoPath: string,
  animationOptions: any,
  onProgress: ( percentage: number ) => void
) {
  const fps = animationOptions?.framerate ?? 60; // Keep this as "intended" FPS, but we won't use it for -r
  const duration = animationOptions?.duration ?? 5;

  // NEW: Count the actual number of PNG frames in the directory
  const files = await fs.readdir( framesDirectory );
  const numFrames = files.filter( ( f ) => f.endsWith( ".png" ) ).length;

  if ( numFrames === 0 ) {
    throw new Error( "No frames found in directory" );
  }

  // NEW: Compute framerate to ensure output video is exactly 'duration' seconds long
  const framerate = numFrames / duration;

  return new Promise<void>( (
    resolve, reject
  ) => {
    const ffmpegProcess = spawn(
      "ffmpeg",
      [
        "-r",
        String( framerate ), // CHANGED: Use computed framerate instead of fixed fps
        "-pattern_type",
        "glob",
        "-i",
        "*.png",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-y",
        outputVideoPath,
        "-progress",
        "pipe:1",
        "-loglevel",
        "error",
      ],
      {
        cwd: framesDirectory,
      }
    );

    // NEW: Use actual numFrames for progress (not fps * duration)
    const totalFrames = numFrames;

    ffmpegProcess.stdout.on(
      "data",
      ( buffer ) => {
        const match = /frame=\s*(\d+)/.exec( buffer.toString() );

        if ( match ) {
          const framesRendered = parseInt(
            match[ 1 ],
            10
          );

          onProgress( Math.min(
            ( framesRendered / totalFrames ) * 100,
            100
          ) );
        }
      }
    );

    ffmpegProcess.on(
      "close",
      ( code ) => {
        if ( code === 0 ) {
          return resolve();
        }

        return reject( new Error( `ffmpeg failed: ${ code }` ) );
      }
    );

    ffmpegProcess.on(
      "error",
      reject
    );
  } );
}

export default encodeVideoFromFrames;
