import {
  ChildProcessWithoutNullStreams, spawn
} from "child_process";
import fs from "node:fs/promises";
import path from "node:path";

type AnimationOptions = {
  framerate?: number; // desired output frames per second (preferred)
  duration?: number; // desired total duration in seconds (fallback if framerate is not provided)
};

function naturalStringCompare(
  a: string, b: string
): number {
  // Natural order compare so "..._2.png" < "..._10.png"
  const aParts = a
    .split( /(\d+)/ )
    .map( ( part ) => ( /\d+/.test( part ) ? Number( part ) : part ) );
  const bParts = b
    .split( /(\d+)/ )
    .map( ( part ) => ( /\d+/.test( part ) ? Number( part ) : part ) );

  const length = Math.max(
    aParts.length,
    bParts.length
  );

  for ( let index = 0; index < length; index++ ) {
    const aPart = aParts[ index ];
    const bPart = bParts[ index ];

    if ( aPart === undefined ) {
      return -1;
    }
    if ( bPart === undefined ) {
      return 1;
    }
    if ( aPart === bPart ) {
      continue;
    }
    if ( typeof aPart === "number" && typeof bPart === "number" ) {
      return aPart - bPart;
    }
    return String( aPart ).localeCompare( String( bPart ) );
  }

  return 0;
}

async function listPngFramesSorted( framesDirectoryPath: string ): Promise<string[]> {
  const directoryEntries = await fs.readdir(
    framesDirectoryPath,
    {
      withFileTypes: true
    }
  );

  const fileNames = directoryEntries
    .filter( ( entry ) => entry.isFile() )
    .map( ( entry ) => entry.name )
    .filter( ( name ) => name.toLowerCase().endsWith( ".png" ) )
    .sort( naturalStringCompare );

  return fileNames;
}

function escapePathForFfmpegConcat( filePath: string ): string {
  // Concat demuxer wants: file 'absolute/path.png'
  // Single-quote and escape any single quotes inside.
  const escaped = filePath.replace(
    /'/g,
    "'\\''"
  );

  return `'${ escaped }'`;
}

async function writeConcatListFile(
  framesDirectoryPath: string,
  sortedFrameFileNames: string[],
  secondsPerFrame: number
): Promise<string> {
  if ( sortedFrameFileNames.length === 0 ) {
    throw new Error( "No PNG frames were found to encode." );
  }

  const lines: string[] = [];

  for ( const fileName of sortedFrameFileNames ) {
    const absolutePath = path.resolve(
      framesDirectoryPath,
      fileName
    );

    lines.push( `file ${ escapePathForFfmpegConcat( absolutePath ) }` );
    lines.push( `duration ${ secondsPerFrame }` );
  }

  // The concat demuxer requires the last file to be repeated once more
  // so that the final frame duration is honored.
  const lastAbsolutePath = path.resolve(
    framesDirectoryPath,
    sortedFrameFileNames[ sortedFrameFileNames.length - 1 ]
  );

  lines.push( `file ${ escapePathForFfmpegConcat( lastAbsolutePath ) }` );

  const listFilePath = path.resolve(
    framesDirectoryPath,
    ".ffmpeg_concat_list.txt"
  );

  await fs.writeFile(
    listFilePath,
    lines.join( "\n" ),
    "utf8"
  );
  return listFilePath;
}

/**
 * Encodes a sequence of PNG frames into an MP4 video with deterministic timing.
 * - Uses the concat demuxer with explicit per-frame durations (robust across ffmpeg builds).
 * - Prefers an explicit "framerate" from options; if absent, derives it from total frames and "duration".
 * - Enforces constant frame rate in the output stream.
 */
export default async function encodeVideoFromFrames(
  framesDirectoryPath: string,
  outputVideoFilePath: string,
  animationOptions: AnimationOptions,
  onProgress: ( percentage: number ) => void
): Promise<void> {
  const sortedFrameFileNames = await listPngFramesSorted( framesDirectoryPath );
  const totalFrameCount = sortedFrameFileNames.length;

  if ( totalFrameCount === 0 ) {
    throw new Error( "No PNG frames found. Cannot encode an empty sequence." );
  }

  // Determine target frames-per-second.
  // Priority 1: explicit framerate from options.
  // Priority 2: derive from duration if provided.
  // Fallback: 60 frames per second as a reasonable default.
  let targetFramesPerSecond: number | undefined = undefined;

  if (
    typeof animationOptions?.framerate === "number" &&
    animationOptions.framerate > 0
  ) {
    targetFramesPerSecond = animationOptions.framerate;
  } else if (
    typeof animationOptions?.duration === "number" &&
    animationOptions.duration > 0
  ) {
    targetFramesPerSecond = totalFrameCount / animationOptions.duration;
  } else {
    targetFramesPerSecond = 60;
  }

  // Keep a few decimal places to get accurate durations when derived from total frames and duration.
  const normalizedFramesPerSecond = Math.max(
    1e-3,
    Number( targetFramesPerSecond.toFixed( 6 ) )
  );
  const secondsPerFrame = 1 / normalizedFramesPerSecond;

  // Build concat list with explicit durations.
  const concatListFilePath = await writeConcatListFile(
    framesDirectoryPath,
    sortedFrameFileNames,
    secondsPerFrame
  );

  // Spawn ffmpeg using the concat demuxer with explicit durations.
  // We still set "-r" on output to ensure a constant-rate stream in the MP4.
  await new Promise<void>( (
    resolve, reject
  ) => {
    const ffmpegArguments: string[] = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",

      // progress must be before the output path
      "-progress",
      "pipe:1",

      // INPUT: concat list with durations
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListFilePath,

      // OUTPUT encoding
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

      // Respect input PTS from concat durations and then produce constant frame rate output
      "-vsync",
      "vfr",
      "-r",
      String( normalizedFramesPerSecond ),

      outputVideoFilePath
    ];

    const ffmpegProcess: ChildProcessWithoutNullStreams = spawn(
      "ffmpeg",
      ffmpegArguments,
      {
        cwd: framesDirectoryPath
      }
    );

    let lastReportedPercentage = -1;
    let collectedStderr = "";

    ffmpegProcess.stdout.on(
      "data",
      ( chunk: Buffer ) => {
        const message = chunk.toString();
        const match = /frame=(\d+)/.exec( message );

        if ( match != null ) {
          const encodedFrameCount = Math.min(
            parseInt(
              match[ 1 ],
              10
            ) || 0,
            totalFrameCount
          );
          const percentage = Math.min(
            100,
            Math.round( ( encodedFrameCount / totalFrameCount ) * 100 )
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
      async( exitCode: number ) => {
      // Best-effort cleanup of the concat list
        try {
          await fs.unlink( concatListFilePath );
        } catch {
        // ignore cleanup errors
        }

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
      async( error: Error ) => {
        try {
          await fs.unlink( concatListFilePath );
        } catch {
        // ignore cleanup errors
        }
        reject( error );
      }
    );
  } );
}
