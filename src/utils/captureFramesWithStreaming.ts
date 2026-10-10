import {
  Page
} from "playwright";
import {
  spawn, ChildProcessWithoutNullStreams
} from "child_process";
import {
  detectCaptureSurface,
  prepareCapture,
  readCaptureFrame,
  renderCaptureFrame
} from "@/utils/captureSurface";
import {
  muxSketchAudio
} from "@/utils/muxSketchAudio";

interface CaptureFramesWithStreamingOptions {
  page: Page;
  totalFrames: number;
  outputVideoPath: string;
  framerate: number;
  onProgress?: ( percentage: number ) => Promise<void>;
}

/**
 * H.264 in yuv420p subsamples chroma by two on both axes, so libx264 refuses an
 * odd width or height outright ("height not divisible by 2") and the whole job
 * fails at encode time — a 540 × 675 canvas was enough. The frames are padded
 * to the next even size instead: one black column and/or row on the right and
 * bottom edge, nothing scaled, nothing cropped. An even canvas passes through
 * untouched (the expressions evaluate to its own size).
 */
export const EVEN_DIMENSIONS_FILTER = "pad=ceil(iw/2)*2:ceil(ih/2)*2";

/** The recorder's FFmpeg command line: PNG frames on stdin → H.264 MP4. */
export function recorderFfmpegArgs(
  framerate: number,
  outputVideoPath: string
): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",

    // Input: PNG images from stdin
    "-f",
    "image2pipe",
    "-framerate",
    String( framerate ),
    "-i",
    "pipe:0",

    // Even dimensions, whatever the canvas (see EVEN_DIMENSIONS_FILTER)
    "-vf",
    EVEN_DIMENSIONS_FILTER,

    // Output encoding
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

    outputVideoPath
  ];
}

/**
 * Server-side frame capture that streams directly to FFmpeg stdin.
 * Frames are encoded in real-time with no intermediate disk I/O.
 */
export async function captureFramesWithStreaming( {
  page,
  totalFrames,
  outputVideoPath,
  framerate,
  onProgress
}: CaptureFramesWithStreamingOptions ): Promise<void> {
  let lastReportedPercentage = -1;

  // Resolve the capture surface + put the engine into deterministic mode.
  const surface = await detectCaptureSurface( page );

  await prepareCapture( page );

  // Spawn FFmpeg process to receive raw PNG frames via stdin
  const ffmpegArgs = recorderFfmpegArgs(
    framerate,
    outputVideoPath
  );

  const ffmpegProcess: ChildProcessWithoutNullStreams = spawn(
    "ffmpeg",
    ffmpegArgs
  );

  let ffmpegError = "";
  let ffmpegExited = false;

  ffmpegProcess.stderr.on(
    "data",
    ( chunk: Buffer ) => {
      ffmpegError += chunk.toString();
    }
  );

  // Listen for the end of FFmpeg from the moment it is spawned, not after the
  // frame loop: an `error` (ENOENT) or a stdin `error` (EPIPE when it dies
  // mid-stream) with no listener is an uncaught exception that takes the
  // whole server's recording system down, and a death during a `drain` wait
  // used to leave the loop waiting forever.
  const ffmpegDone = new Promise<void>( (
    resolve, reject
  ) => {
    ffmpegProcess.once(
      "error",
      ( error: Error ) => {
        ffmpegExited = true;
        reject( error );
      }
    );

    ffmpegProcess.once(
      "close",
      ( exitCode: number | null ) => {
        ffmpegExited = true;

        if ( exitCode === 0 ) {
          resolve();
        } else {
          reject( new Error( `FFmpeg exited with code ${ exitCode }\n${ ffmpegError }` ) );
        }
      }
    );
  } );

  // Observed now so an early failure is never an unhandled rejection; the
  // loop and the final await below still see it.
  ffmpegDone.catch( () => {} );

  // EPIPE and friends: the process's own `close`/`error` carries the reason.
  ffmpegProcess.stdin.on(
    "error",
    () => {}
  );

  const exitedEarly = () => ffmpegDone.then( () => {
    throw new Error( "FFmpeg exited before every frame was written" );
  } );

  try {
    // Capture and stream frames one by one
    for ( let frameIndex = 0; frameIndex < totalFrames; frameIndex++ ) {
      // Render this frame deterministically (engine controller advances time).
      await renderCaptureFrame(
        page,
        frameIndex
      );

      // Small delay to ensure frame is rendered
      await page.waitForTimeout( 10 );

      // Grab the frame (canvas pixels or DOM screenshot per engine).
      const frameBuffer = await readCaptureFrame(
        page,
        surface
      );

      if ( ffmpegExited ) {
        await exitedEarly();
      }

      // Write frame directly to FFmpeg stdin
      const canWrite = ffmpegProcess.stdin.write( frameBuffer );

      // If the buffer is full, wait for drain — or for FFmpeg to die
      if ( !canWrite ) {
        await Promise.race( [
          new Promise<void>( ( resolve ) => {
            ffmpegProcess.stdin.once(
              "drain",
              resolve
            );
          } ),
          exitedEarly()
        ] );
      }

      // Report progress
      const percentage = Math.round( ( ( frameIndex + 1 ) / totalFrames ) * 100 );

      if ( onProgress && percentage !== lastReportedPercentage ) {
        lastReportedPercentage = percentage;
        await onProgress( percentage );
      }
    }

    // Close stdin to signal end of input
    ffmpegProcess.stdin.end();

    // Wait for FFmpeg to finish encoding
    await ffmpegDone;

    // Video is done — if the sketch logged audio events during the frame
    // loop (capture mode is armed by prepareCapture), render them offline
    // in the page and mux the result into the file. No-op for sketches
    // without an audio bridge; never fails the recording.
    await muxSketchAudio( {
      page,
      outputVideoPath,
      durationSeconds: totalFrames / framerate
    } );
  } catch( error ) {
    // Kill FFmpeg if still running
    if ( !ffmpegExited && !ffmpegProcess.killed ) {
      ffmpegProcess.kill( "SIGKILL" );
    }
    throw error;
  }
}
