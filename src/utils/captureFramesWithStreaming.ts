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
  const ffmpegArgs = [
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

  const ffmpegProcess: ChildProcessWithoutNullStreams = spawn(
    "ffmpeg",
    ffmpegArgs
  );

  let ffmpegError = "";

  ffmpegProcess.stderr.on(
    "data",
    ( chunk: Buffer ) => {
      ffmpegError += chunk.toString();
    }
  );

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

      // Write frame directly to FFmpeg stdin
      const canWrite = ffmpegProcess.stdin.write( frameBuffer );

      // If the buffer is full, wait for drain
      if ( !canWrite ) {
        await new Promise<void>( ( resolve ) => {
          ffmpegProcess.stdin.once(
            "drain",
            resolve
          );
        } );
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
    await new Promise<void>( (
      resolve, reject
    ) => {
      ffmpegProcess.on(
        "close",
        ( exitCode: number ) => {
          if ( exitCode === 0 ) {
            resolve();
          } else {
            reject( new Error( `FFmpeg exited with code ${ exitCode }\n${ ffmpegError }` ) );
          }
        }
      );

      ffmpegProcess.on(
        "error",
        ( error: Error ) => {
          reject( error );
        }
      );
    } );

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
    if ( !ffmpegProcess.killed ) {
      ffmpegProcess.kill( "SIGKILL" );
    }
    throw error;
  }
}
