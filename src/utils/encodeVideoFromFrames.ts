import {
  spawn, ChildProcessWithoutNullStreams
} from "child_process";
import fs from "node:fs/promises";

type AnimationOptions = {
  framerate?: number;
  duration?: number; // not required for encoding; used only if you want to display ETA elsewhere
};

async function countPngFrameFiles( framesDirectoryPath: string ): Promise<number> {
  const directoryEntries = await fs.readdir(
    framesDirectoryPath,
    {
      withFileTypes: true
    }
  );
  const frameFiles = directoryEntries.filter( ( entry ) => {
    if ( !entry.isFile() ) {
      return false;
    }
    const lowerCaseName = entry.name.toLowerCase();

    return lowerCaseName.endsWith( ".png" );
  } );

  return frameFiles.length;
}

/**
 * Encodes a sequence of PNG frames into an MP4 video at a constant frame rate.
 * - Uses `-framerate` for the input (correct for image sequences).
 * - Uses `-r` for the output (enforces constant frame rate in the encoded stream).
 * - Reads ffmpeg `-progress pipe:1` to report progress by counting frames.
 */
export default async function encodeVideoFromFrames(
  framesDirectoryPath: string,
  outputVideoFilePath: string,
  animationOptions: AnimationOptions,
  onProgress: ( percentage: number ) => void
): Promise<void> {
  const framesPerSecond = Math.max(
    1,
    Math.floor( animationOptions?.framerate ?? 60 )
  );
  const totalFrameCount = Math.max(
    1,
    await countPngFrameFiles( framesDirectoryPath )
  );

  return new Promise<void>( (
    resolve, reject
  ) => {
    const ffmpegArguments: string[] = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",

      // Emit machine-readable progress to stdout BEFORE the output file path
      "-progress",
      "pipe:1",

      // INPUT (image sequence)
      // Important: -framerate is an INPUT option
      "-framerate",
      String( framesPerSecond ),
      "-pattern_type",
      "glob",
      "-i",
      "*.png",

      // OUTPUT
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      "-vsync",
      "cfr", // enforce constant frame rate
      "-r",
      String( framesPerSecond ), // OUTPUT frame rate

      outputVideoFilePath,
    ];

    const ffmpegProcess: ChildProcessWithoutNullStreams = spawn(
      "ffmpeg",
      ffmpegArguments,
      {
        cwd: framesDirectoryPath,
      }
    );

    let lastReportedPercentage = -1;
    let collectedStderr = "";

    // ffmpeg -progress prints key=value lines; one of them is frame=NUMBER
    ffmpegProcess.stdout.on(
      "data",
      ( chunk: Buffer ) => {
        const text = chunk.toString();
        const match = /frame=(\d+)/.exec( text );

        if ( match != null ) {
          const renderedFrameCount = Math.min(
            parseInt(
              match[ 1 ],
              10
            ) || 0,
            totalFrameCount
          );
          const percentage = Math.min(
            100,
            Math.round( ( renderedFrameCount / totalFrameCount ) * 100 )
          );

          if ( percentage !== lastReportedPercentage ) {
            lastReportedPercentage = percentage;
            onProgress( percentage );
          }
        }
      }
    );

    ffmpegProcess.stderr.on(
      "data",
      ( chunk: Buffer ) => {
        collectedStderr += chunk.toString();
      }
    );

    ffmpegProcess.on(
      "close",
      ( exitCode: number ) => {
        if ( exitCode === 0 ) {
          resolve();
          return;
        }

        const error = new Error( `ffmpeg process exited with code ${ exitCode }\n${ collectedStderr }` );

        reject( error );
      }
    );

    ffmpegProcess.on(
      "error",
      ( error: Error ) => {
        reject( error );
      }
    );
  } );
}
