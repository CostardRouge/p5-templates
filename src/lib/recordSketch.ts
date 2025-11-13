import encodeVideoFromFrames from "@/utils/encodeVideoFromFrames";
import createBrowserPage from "@/utils/createBrowserPage";
import captureFirstFrame from "@/utils/captureFirstFrame";
import {
  captureFramesServerSide
} from "@/utils/captureFramesServerSide";
import {
  captureFramesWithStreaming
} from "@/utils/captureFramesWithStreaming";

import {
  updateJob
} from "@/lib/jobStore";

import {
  uploadArtifact
} from "@/lib/connections/s3";

import path from "path";
import fs from "node:fs/promises";

import {
  Browser, Page
} from "playwright";
import {
  updateRecordingStepPercentage,
  addRecordingDuration
} from "@/lib/progression";
import {
  NotificationService
} from "@/services/NotificationService";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION: Toggle between capture methods
// ═══════════════════════════════════════════════════════════════════════════

/**
 * USE_STREAMING_MODE - Toggle between disk-based and streaming capture
 *
 * false (default) - Disk-based capture:
 *   - Captures frames to disk, then encodes with FFmpeg
 *   - Stable and tested
 *   - Easy to debug (frames visible on disk)
 *   - Can extract thumbnail from first frame
 *
 * true - Streaming mode (experimental):
 *   - Streams frames directly to FFmpeg (no disk I/O)
 *   - Lower memory usage (~40% less)
 *   - Faster for long videos (~20% faster)
 *   - Thumbnail captured via screenshot
 *
 * To test streaming mode: Change this to true
 */
const USE_STREAMING_MODE = process.env.USE_STREAMING_MODE ?? false;

// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate total frames from animation options
 */
function calculateTotalFrames( animationOptions: any ): number {
  const framerate = animationOptions?.framerate || 60;
  const duration = animationOptions?.duration || 5;

  return Math.round( duration * framerate );
}

/**
 * Unified recording function that handles both single and multi-slide recordings
 */
async function recordSketch(
  jobId: string,
  template: string,
  options: Record<string, any>,
  temporaryDirectoryPath: string
) {
  const recordingState: {
    page?: Page,
    browser?: Browser,
  } = {
    page: undefined
  };

  const recordingStartAt = new Date();

  try {
    const {
      createPage,
      browser
    } = await createBrowserPage( {
      headless: true,
      deviceScaleFactor: 1
    } );

    recordingState.browser = browser;
    recordingState.page = await createPage();

    // Update recording start time
    await updateJob(
      jobId,
      {
        recordingStartAt
      }
    );

    const slides = options.slides ?? null;
    const hasSlides = slides && Array.isArray( slides ) && slides.length > 0;

    if ( hasSlides ) {
      // ─── Multi-slide recording ─────────────────────────────────────────────
      await recordMultipleSlides(
        jobId,
        template,
        options,
        slides,
        recordingState.page,
        temporaryDirectoryPath
      );
    } else {
      // ─── Single recording ──────────────────────────────────────────────────
      await recordSingleSketch(
        jobId,
        template,
        options,
        recordingState.page,
        temporaryDirectoryPath
      );
    }

    // Update recording end time and duration
    const recordingEndAt = new Date();
    const recordingDuration = recordingEndAt.getTime() - recordingStartAt.getTime();

    await updateJob(
      jobId,
      {
        recordingEndAt,
        recordingDuration
      }
    );

    // Store recordingDuration in Redis cache for SSE streaming
    await addRecordingDuration( jobId, recordingDuration );
  }
  catch ( error ) {
    await updateJob(
      jobId,
      {
        status: "failed",
        progress: 100
      }
    );

    // Send failure notification
    const notificationService = NotificationService.getInstance();
    await notificationService.sendJobFailureNotification( jobId, template );

    throw error;
  }
  finally {
    await fs.rm(
      temporaryDirectoryPath,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );

    await recordingState?.browser?.close();
  }
}

/**
 * Record a single sketch (no slides)
 */
async function recordSingleSketch(
  jobId: string,
  template: string,
  options: Record<string, any>,
  page: Page,
  temporaryDirectoryPath: string
) {
  // ─── Launch browser & load sketch ─────────────────────────────────────────
  await updateRecordingStepPercentage(
    jobId,
    "recording.launching-browser",
    0
  );

  await page.goto(
    `http://localhost:3000/templates/${ template }?id=${ jobId }&capturing`,
    {
      waitUntil: "networkidle"
    },
  );

  await page.waitForSelector( "canvas#defaultCanvas0.loaded" );

  await updateRecordingStepPercentage(
    jobId,
    "recording.launching-browser",
    100
  );

  // ─── Capture frames and encode video ──────────────────────────────────────
  const totalFrames = calculateTotalFrames( options.animation );
  const framerate = options.animation?.framerate || 60;
  const outputVideoPath = path.join(
    temporaryDirectoryPath,
    `${ path.basename( template ) }-${ jobId }.mp4`
  );
  const thumbnailPath = path.join(
    temporaryDirectoryPath,
    `thumbnail-${ jobId }.jpg`
  );

  if ( USE_STREAMING_MODE ) {
    // ─── Streaming mode: Direct to FFmpeg (no disk I/O) ───────────────────
    await captureFramesWithStreaming( {
      page,
      totalFrames,
      outputVideoPath,
      framerate,
      onProgress: async( percentage: number ) => {
        await updateRecordingStepPercentage(
          jobId,
          "recording.saving-frames",
          percentage
        );
      },
    } );

    await page.close();

    // Capture thumbnail via canvas screenshot
    const {
      createPage: createThumbnailPage
    } = await createBrowserPage( {
      headless: true,
      deviceScaleFactor: 1
    } );
    const thumbnailPage = await createThumbnailPage();

    await thumbnailPage.goto(
      `http://localhost:3000/templates/${ template }?id=${ jobId }&capturing`,
      {
        waitUntil: "networkidle"
      }
    );
    await thumbnailPage.waitForSelector( "canvas#defaultCanvas0.loaded" );

    const canvas = await thumbnailPage.locator( "canvas#defaultCanvas0" );

    await canvas.screenshot( {
      path: thumbnailPath,
      type: "jpeg",
      quality: 90
    } );
    await thumbnailPage.close();
  } else {
    // ─── Disk-based mode: Capture to disk, then encode ────────────────────
    const framesDirectory = path.join(
      temporaryDirectoryPath,
      "frames"
    );

    await captureFramesServerSide( {
      page,
      framesDirectory,
      totalFrames,
      onProgress: async( percentage: number ) => {
        await updateRecordingStepPercentage(
          jobId,
          "recording.saving-frames",
          percentage
        );
      },
    } );

    await page.close();

    // Capture thumbnail from first frame
    await captureFirstFrame(
      framesDirectory,
      thumbnailPath
    );

    // Encode video from frames
    await encodeVideoFromFrames(
      framesDirectory,
      outputVideoPath,
      options.animation,
      async( percentage ) => {
        await updateRecordingStepPercentage(
          jobId,
          "recording.encoding-frames",
          percentage
        );
      }
    );

    // Cleanup frames
    await fs.rm(
      framesDirectory,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );
  }

  // ─── Upload to S3 ─────────────────────────────────────────────────────────
  await updateRecordingStepPercentage(
    jobId,
    "uploading",
    0
  );

  const videoBuffer = await fs.readFile( outputVideoPath );
  const videoSize = videoBuffer.length;

  const videoS3Url = await uploadArtifact(
    `${ jobId }/${ path.basename( outputVideoPath ) }`,
    videoBuffer
  );

  const thumbnailS3Url = await uploadArtifact(
    `${ jobId }/${ path.basename( thumbnailPath ) }`,
    await fs.readFile( thumbnailPath )
  );

  await updateRecordingStepPercentage(
    jobId,
    "uploading",
    100
  );

  // ─── Mark job complete ────────────────────────────────────────────────────
  await updateJob(
    jobId,
    {
      status: "completed",
      progress: 100,
      resultUrl: videoS3Url,
      thumbnails: [
        thumbnailS3Url
      ],
      videoUrls: [
        videoS3Url
      ],
      videoSizes: [
        videoSize
      ]
    }
  );

  // Send completion notification
  const notificationService = NotificationService.getInstance();
  await notificationService.sendJobCompletionNotification( jobId, template );
}

/**
 * Record multiple slides
 */
async function recordMultipleSlides(
  jobId: string,
  template: string,
  options: Record<string, any>,
  slides: any[],
  page: Page,
  temporaryDirectoryPath: string
) {
  const slideVideoPaths: string[] = [
  ];
  const slideThumbnailPaths: string[] = [
  ];

  for ( let slideIndex = 0; slideIndex < slides.length; slideIndex++ ) {
    // ─── Launch browser & load slide ─────────────────────────────────────────
    await updateRecordingStepPercentage(
      jobId,
      `recording.slide-${ slideIndex }.launching-browser`,
      0
    );

    await page.goto(
      `http://localhost:3000/templates/${ template }?id=${ jobId }&capturing`,
      {
        waitUntil: "networkidle"
      },
    );

    await page.waitForSelector( "canvas#defaultCanvas0.loaded" );
    await page.evaluate(
      ( index ) => window.setSlide( index ),
      slideIndex
    );

    await page.waitForSelector(
      `canvas[data-slide="${ slideIndex }"]`,
      {
        timeout: 0
      }
    );

    await updateRecordingStepPercentage(
      jobId,
      `recording.slide-${ slideIndex }.launching-browser`,
      100
    );

    // ─── Capture frames and encode video ────────────────────────────────────
    const slideOptions = slides[ slideIndex ];
    const slideAnimation = slideOptions?.animation || options.animation;
    const totalFrames = calculateTotalFrames( slideAnimation );
    const framerate = slideAnimation?.framerate || 60;

    console.log( {
      totalFrames,
      framerate
    } );

    const slideVideoPath = path.join(
      temporaryDirectoryPath,
      `${ path.basename( template ) }_${ slideIndex }.mp4`
    );
    const slideThumbnailPath = path.join(
      temporaryDirectoryPath,
      `thumbnail-slide-${ slideIndex }-${ jobId }.jpg`
    );

    if ( USE_STREAMING_MODE ) {
      // ─── Streaming mode: Direct to FFmpeg (no disk I/O) ─────────────────
      await captureFramesWithStreaming( {
        page,
        totalFrames,
        outputVideoPath: slideVideoPath,
        framerate,
        onProgress: async( percentage: number ) => {
          await updateRecordingStepPercentage(
            jobId,
            `recording.slide-${ slideIndex }.saving-frames`,
            percentage
          );
        },
      } );

      // Capture thumbnail via canvas screenshot
      const canvas = await page.locator( "canvas#defaultCanvas0" );

      await canvas.screenshot( {
        path: slideThumbnailPath,
        type: "jpeg",
        quality: 90
      } );
    } else {
      // ─── Disk-based mode: Capture to disk, then encode ──────────────────
      const slideFramesDirectory = path.join(
        temporaryDirectoryPath,
        `frames_slide_${ slideIndex }`
      );

      await captureFramesServerSide( {
        page,
        framesDirectory: slideFramesDirectory,
        totalFrames,
        onProgress: async( percentage: number ) => {
          await updateRecordingStepPercentage(
            jobId,
            `recording.slide-${ slideIndex }.saving-frames`,
            percentage
          );
        },
      } );

      // Capture thumbnail from first frame
      await captureFirstFrame(
        slideFramesDirectory,
        slideThumbnailPath
      );

      // Encode video from frames
      await encodeVideoFromFrames(
        slideFramesDirectory,
        slideVideoPath,
        slideAnimation,
        async( percentage: number ) => {
          await updateRecordingStepPercentage(
            jobId,
            `recording.slide-${ slideIndex }.encoding-frames`,
            percentage
          );
        }
      );

      // Cleanup frames
      await fs.rm(
        slideFramesDirectory,
        {
          recursive: true,
          force: true
        }
      ).catch( () => {} );
    }

    slideVideoPaths.push( slideVideoPath );
    slideThumbnailPaths.push( slideThumbnailPath );
  }

  // ─── Upload all videos and thumbnails ───────────────────────────────────
  await updateRecordingStepPercentage(
    jobId,
    "uploading.s3",
    0
  );

  const videoS3Urls: string[] = [
  ];
  const thumbnailS3Urls: string[] = [
  ];
  const videoSizes: number[] = [
  ];

  // Upload all videos
  for ( let i = 0; i < slideVideoPaths.length; i++ ) {
    const videoPath = slideVideoPaths[ i ];
    const videoBuffer = await fs.readFile( videoPath );
    const videoSize = videoBuffer.length;

    const videoS3Url = await uploadArtifact(
      `${ jobId }/${ path.basename( videoPath ) }`,
      videoBuffer
    );

    videoS3Urls.push( videoS3Url );
    videoSizes.push( videoSize );
    await fs.unlink( videoPath ).catch( () => {} );
  }

  // Upload all thumbnails
  for ( let i = 0; i < slideThumbnailPaths.length; i++ ) {
    const thumbnailPath = slideThumbnailPaths[ i ];
    const thumbnailS3Url = await uploadArtifact(
      `${ jobId }/${ path.basename( thumbnailPath ) }`,
      await fs.readFile( thumbnailPath )
    );

    thumbnailS3Urls.push( thumbnailS3Url );
    await fs.unlink( thumbnailPath ).catch( () => {} );
  }

  await updateRecordingStepPercentage(
    jobId,
    "uploading.s3",
    100
  );

  // ─── Mark job complete ──────────────────────────────────────────────────
  await updateJob(
    jobId,
    {
      status: "completed",
      progress: 100,
      resultUrl: videoS3Urls[ 0 ] || null,
      thumbnails: thumbnailS3Urls,
      videoUrls: videoS3Urls,
      videoSizes: videoSizes
    }
  );

  // Send completion notification
  const notificationService = NotificationService.getInstance();
  await notificationService.sendJobCompletionNotification( jobId, template );
}

export default recordSketch;