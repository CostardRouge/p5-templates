import {
  ChildProcessWithoutNullStreams, spawn
} from "child_process";
import path from "node:path";
import {
  PREVIEW_FPS, PREVIEW_SECS
} from "@/lib/previewConfig";

/**
 * Re-encodes a recorded clip (the WebM/MP4 blob produced by a realtime
 * browser capture) into a committed VP9 preview loop at one target size.
 *
 * Mirrors {@link encodePreviewFromFrames}'s output settings (VP9, CRF 37,
 * cpu-used 4) so a "Record preview" clip is indistinguishable from one the
 * headless generator produced. The source is scaled to *cover* the target
 * box and centre-cropped — interactive captures can arrive at any aspect
 * ratio, and stretching them would distort the framing. Audio is dropped:
 * committed previews are silent hover loops.
 */
export default async function encodePreviewFromVideo(
  inputPath: string,
  outputPath: string,
  targetSize: { width: number;
    height: number },
  durationSecs = PREVIEW_SECS,
  outputFps = PREVIEW_FPS
): Promise<void> {
  // Resolve to absolute so FFmpeg finds both paths regardless of its cwd.
  const absoluteInput = path.resolve( inputPath );
  const absoluteOutput = path.resolve( outputPath );

  await new Promise<void>( (
    resolve, reject
  ) => {
    const args: string[] = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      absoluteInput,
      // Guard against a slightly over-long capture — trim to the canonical
      // preview length so every committed loop is the same duration.
      "-t",
      String( durationSecs ),
      "-an",
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
      "-vf",
      `scale=${ targetSize.width }:${ targetSize.height }:force_original_aspect_ratio=increase,` +
        `crop=${ targetSize.width }:${ targetSize.height }`,
      absoluteOutput
    ];

    const proc: ChildProcessWithoutNullStreams = spawn(
      "ffmpeg",
      args
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
      ( code: number ) => {
        if ( code === 0 ) {
          resolve();
        } else {
          reject( new Error( `ffmpeg exited with code ${ code }\n${ stderr }` ) );
        }
      }
    );

    proc.on(
      "error",
      ( err: Error ) => {
        reject( err );
      }
    );
  } );
}
