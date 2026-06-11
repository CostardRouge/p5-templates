import {
  Page
} from "playwright";
import {
  spawn
} from "child_process";
import fs from "node:fs/promises";

// Side-effect import: pulls in the `window.__sketchAudio` global
// declaration used by the page.evaluate below.
import type {} from "@/lib/audioBridge";

interface MuxSketchAudioOptions {
  page: Page;
  /** Finished video file the audio gets muxed into (replaced in place). */
  outputVideoPath: string;
  /** Clip duration in seconds (totalFrames / framerate). */
  durationSeconds: number;
}

/**
 * Pull the sketch's offline-rendered audio out of the page and mux it
 * into the already-encoded video.
 *
 * The audio bridge logged every `trigger()` during the deterministic
 * frame loop (capture mode is switched on by `prepareCapture`). Here we
 * ask the page to replay that log through an OfflineAudioContext and
 * hand the result back as a base64 WAV — Playwright can't transfer an
 * AudioBuffer — then FFmpeg muxes it with `-c:v copy`, so the video
 * stream is not re-encoded.
 *
 * Returns `true` when audio was muxed. Sketches without an audio bridge
 * (or that triggered no sound) return `false` and the video is left
 * untouched. Audio failures are deliberately non-fatal: a video without
 * sound beats a failed job.
 */
export async function muxSketchAudio( {
  page,
  outputVideoPath,
  durationSeconds
}: MuxSketchAudioOptions ): Promise<boolean> {
  let wavBase64: string | null = null;

  try {
    wavBase64 = await page.evaluate(
      async( duration ) => {
        const bridge = window.__sketchAudio;

        if ( !bridge?.renderOfflineWav ) {
          return null;
        }

        try {
          return await bridge.renderOfflineWav( {
            duration
          } );
        } finally {
          // Always leave capture mode so a reused page (multi-slide
          // recordings) starts the next slide with a clean event log.
          bridge.endCapture();
        }
      },
      durationSeconds
    );
  } catch( error ) {
    console.warn(
      "muxSketchAudio: offline render failed, keeping video-only output.",
      error
    );

    return false;
  }

  if ( !wavBase64 ) {
    return false;
  }

  const wavPath = `${ outputVideoPath }.wav`;
  const muxedPath = `${ outputVideoPath }.muxed.mp4`;

  try {
    await fs.writeFile(
      wavPath,
      Buffer.from(
        wavBase64,
        "base64"
      )
    );

    await runFfmpegMux(
      outputVideoPath,
      wavPath,
      muxedPath
    );

    await fs.rename(
      muxedPath,
      outputVideoPath
    );

    return true;
  } catch( error ) {
    console.warn(
      "muxSketchAudio: FFmpeg mux failed, keeping video-only output.",
      error
    );

    return false;
  } finally {
    await fs.unlink( wavPath ).catch( () => {} );
    await fs.unlink( muxedPath ).catch( () => {} );
  }
}

function runFfmpegMux(
  videoPath: string,
  wavPath: string,
  outPath: string
): Promise<void> {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",

    "-i",
    videoPath,
    "-i",
    wavPath,

    // Copy the video stream untouched; encode the WAV to AAC. `-shortest`
    // guards against a rounding mismatch between the two durations.
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",

    outPath
  ];

  return new Promise<void>( (
    resolve, reject
  ) => {
    const ffmpegProcess = spawn(
      "ffmpeg",
      args
    );

    let ffmpegError = "";

    ffmpegProcess.stderr.on(
      "data",
      ( chunk: Buffer ) => {
        ffmpegError += chunk.toString();
      }
    );

    ffmpegProcess.on(
      "close",
      ( exitCode: number ) => {
        if ( exitCode === 0 ) {
          resolve();
        } else {
          reject( new Error( `FFmpeg mux exited with code ${ exitCode }\n${ ffmpegError }` ) );
        }
      }
    );

    ffmpegProcess.on(
      "error",
      reject
    );
  } );
}
