import { Page } from "playwright";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import fs from "node:fs/promises";
import path from "path";

interface CaptureFramesWithStreamingOptions {
  page: Page;
  totalFrames: number;
  outputVideoPath: string;
  framerate: number;
  onProgress?: (percentage: number) => Promise<void>;
}

/**
 * Advanced server-side frame capture that streams directly to FFmpeg.
 * This is the most memory-efficient approach as frames never touch disk.
 * 
 * Note: This is an experimental optimization. Use captureFramesServerSide
 * for the stable disk-based approach.
 */
export async function captureFramesWithStreaming({
  page,
  totalFrames,
  outputVideoPath,
  framerate,
  onProgress,
}: CaptureFramesWithStreamingOptions): Promise<void> {
  let lastReportedPercentage = -1;

  // Initialize the sketch for frame-by-frame capture
  await page.evaluate(() => {
    // @ts-ignore - p5.js global functions
    if (typeof window.noLoop === "function") {
      // @ts-ignore
      window.noLoop();
    }
    // Enable recording mode (resets time and enables frame-based timing)
    // @ts-ignore - global function exposed by time utility
    if (typeof window.enableRecordingMode === "function") {
      // @ts-ignore
      window.enableRecordingMode();
    }
  });

  // Spawn FFmpeg process to receive raw PNG frames via stdin
  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    
    // Input: PNG images from stdin
    "-f", "image2pipe",
    "-framerate", String(framerate),
    "-i", "pipe:0",
    
    // Output encoding
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "fast",
    "-crf", "23",
    "-movflags", "+faststart",
    
    outputVideoPath,
  ];

  const ffmpegProcess: ChildProcessWithoutNullStreams = spawn("ffmpeg", ffmpegArgs);

  let ffmpegError = "";
  ffmpegProcess.stderr.on("data", (chunk: Buffer) => {
    ffmpegError += chunk.toString();
  });

  try {
    // Capture and stream frames one by one
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      // Trigger a single frame draw (time advances automatically via incrementElapsedTime)
      await page.evaluate(() => {
        // @ts-ignore - p5.js global function
        if (typeof window.redraw === "function") {
          // @ts-ignore
          window.redraw();
        }
      });

      // Small delay to ensure frame is rendered
      await page.waitForTimeout(10);

      // Get the canvas frame as base64
      const frameDataUrl = await page.evaluate(() => {
        const canvas = document.querySelector("canvas#defaultCanvas0") as HTMLCanvasElement;
        if (!canvas) {
          throw new Error("Canvas element not found");
        }
        return canvas.toDataURL("image/png");
      });

      // Decode base64 to buffer
      const base64Data = frameDataUrl.replace(/^data:image\/png;base64,/, "");
      const frameBuffer = Buffer.from(base64Data, "base64");

      // Write frame directly to FFmpeg stdin
      const canWrite = ffmpegProcess.stdin.write(frameBuffer);
      
      // If the buffer is full, wait for drain
      if (!canWrite) {
        await new Promise<void>((resolve) => {
          ffmpegProcess.stdin.once("drain", resolve);
        });
      }

      // Report progress
      const percentage = Math.round(((frameIndex + 1) / totalFrames) * 100);
      if (onProgress && percentage !== lastReportedPercentage) {
        lastReportedPercentage = percentage;
        await onProgress(percentage);
      }
    }

    // Close stdin to signal end of input
    ffmpegProcess.stdin.end();

    // Wait for FFmpeg to finish encoding
    await new Promise<void>((resolve, reject) => {
      ffmpegProcess.on("close", (exitCode: number) => {
        if (exitCode === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${exitCode}\n${ffmpegError}`));
        }
      });

      ffmpegProcess.on("error", (error: Error) => {
        reject(error);
      });
    });
  } catch (error) {
    // Kill FFmpeg if still running
    if (!ffmpegProcess.killed) {
      ffmpegProcess.kill("SIGKILL");
    }
    throw error;
  }
}
