import {
  ChildProcessWithoutNullStreams, spawn
} from "child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  listPngFramesSorted, writeConcatList
} from "@/utils/ffmpegFrameHelpers";

/**
 * Encodes a sequence of PNG frames into a WebM (VP9) preview clip.
 *
 * The total number of frames determines the animation coverage; targetDurationSecs
 * controls how fast it plays back. All frames are compressed to fit in
 * targetDurationSecs regardless of how many were captured.
 *
 * Targets small file size over maximum quality — CRF 37 with cpu-used 4
 * gives a good balance for short preview loops committed to the repo.
 */
export default async function encodePreviewFromFrames(
  framesDir: string,
  outputPath: string,
  targetDurationSecs = 2.5,
  outputFps = 24,
  targetSize?: { width: number;
    height: number }
): Promise<void> {
  const files = await listPngFramesSorted( framesDir );

  if ( files.length === 0 ) {
    throw new Error( "No PNG frames found for preview encoding." );
  }

  // Spread all captured frames evenly across targetDurationSecs
  const secondsPerFrame = targetDurationSecs / files.length;
  const listPath = await writeConcatList(
    framesDir,
    files,
    secondsPerFrame,
    ".ffmpeg_preview_list.txt"
  );
  // Resolve to absolute so FFmpeg finds the output regardless of its cwd
  const absoluteOutputPath = path.resolve( outputPath );

  await new Promise<void>( (
    resolve, reject
  ) => {
    const args: string[] = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:v",
      "libvpx-vp9",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "37",
      "-b:v",
      "0",
      "-deadline",
      "good",
      "-cpu-used",
      "4",
      "-row-mt",
      "1",
      "-r",
      String( outputFps ),
      ...( targetSize
        ? [
          "-vf",
          `scale=${ targetSize.width }:${ targetSize.height }`
        ]
        : [] ),
      absoluteOutputPath
    ];

    const proc: ChildProcessWithoutNullStreams = spawn(
      "ffmpeg",
      args,
      {
        cwd: framesDir
      }
    );

    let stderr = "";

    proc.stderr.on(
      "data",
      ( c: Buffer ) => {
        stderr += c.toString();
      }
    );

    proc.on(
      "close",
      async( code: number ) => {
        await fs.unlink( listPath ).catch( () => {} );

        if ( code === 0 ) {
          resolve();
        } else {
          reject( new Error( `ffmpeg exited with code ${ code }\n${ stderr }` ) );
        }
      }
    );

    proc.on(
      "error",
      async( err: Error ) => {
        await fs.unlink( listPath ).catch( () => {} );
        reject( err );
      }
    );
  } );
}
