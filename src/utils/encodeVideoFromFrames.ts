import {
  spawn
} from "child_process";

async function encodeVideoFromFrames(
  framesDirectory: string,
  outputVideoPath: string,
  animationOptions: any,
  onProgress: ( percentage: number ) => void
) {
  const fps = animationOptions?.framerate ?? 60;
  const duration = animationOptions?.duration ?? 5;

  return new Promise<void>( (
    resolve, reject
  ) => {
    const ffmpegProcess = spawn(
      "ffmpeg",
      [
        "-r",
        String( fps ),
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
        cwd: framesDirectory
      }
    );

    ffmpegProcess.stdout.on(
      "data",
      buffer => {
        const match = /frame=\s*(\d+)/.exec( buffer.toString() );

        if ( match ) {
          const framesRendered = parseInt(
            match[ 1 ],
            10
          );
          const totalFrames = fps * duration;

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