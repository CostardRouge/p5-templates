import createBrowserPage from "@/utils/createBrowserPage";
import {
  captureFramesWithStreaming
} from "@/utils/captureFramesWithStreaming";
import {
  captureCanvasThumbnail
} from "@/utils/captureCanvasThumbnail";

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
  addRecordingDuration, updateCurrentSlide, updateRecordingStepPercentage
} from "@/lib/progression";
import {
  NotificationService
} from "@/services/NotificationService";
import {
  buildRecordingStepPath,
  buildSlideStepPath,
  buildUploadStepPath,
  RECORDING_STEPS,
  UPLOAD_STEPS
} from "@/lib/progression/stepConfig";


/**
 * Wait for the sketch canvas to be ready.
 *
 * Routes (`/templates/…`) signal readiness via a
 * `[data-engine-ready]` attribute set by `EngineSketchRenderer`.
 * Legacy p5 routes use the `canvas.p5Canvas.loaded` selector.
 */
async function waitForSketchReady(
  page: Page,
  template: string
): Promise<void> {
  if ( template.startsWith( "templates/" ) ) {
    await page.waitForSelector( "[data-engine-ready]" );
  } else {
    await page.waitForSelector( "canvas.p5Canvas.loaded" );
  }
}

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
    page?: Page;
    browser?: Browser;
  } = {
    page: undefined
  };

  const recordingStartAt = new Date();

  try {
    const {
      createPage, browser
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
    const recordingDuration =
      recordingEndAt.getTime() - recordingStartAt.getTime();

    await updateJob(
      jobId,
      {
        recordingEndAt,
        recordingDuration
      }
    );

    // Store recordingDuration in Redis cache for SSE streaming
    await addRecordingDuration(
      jobId,
      recordingDuration
    );
  } catch( error ) {
    await updateJob(
      jobId,
      {
        status: "failed",
        progress: 100
      }
    );

    // Send failure notification
    const notificationService = NotificationService.getInstance();

    await notificationService.sendJobFailureNotification(
      jobId,
      template
    );

    throw error;
  } finally {
    await fs
      .rm(
        temporaryDirectoryPath,
        {
          recursive: true,
          force: true
        }
      )
      .catch( () => {} );

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
    buildRecordingStepPath( RECORDING_STEPS.LAUNCHING_BROWSER.key ),
    0
  );

  await page.goto(
    `http://localhost:3000/${ template }?id=${ jobId }&capturing`,
    {
      waitUntil: "networkidle"
    }
  );

  await waitForSketchReady(
    page,
    template
  );

  await updateRecordingStepPercentage(
    jobId,
    buildRecordingStepPath( RECORDING_STEPS.LAUNCHING_BROWSER.key ),
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

  await captureFramesWithStreaming( {
    page,
    totalFrames,
    outputVideoPath,
    framerate,
    onProgress: async( percentage: number ) => {
      await updateRecordingStepPercentage(
        jobId,
        buildRecordingStepPath( RECORDING_STEPS.ENCODING.key ),
        percentage
      );
    }
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
    `http://localhost:3000/${ template }?id=${ jobId }&capturing`,
    {
      waitUntil: "networkidle"
    }
  );

  await captureCanvasThumbnail(
    thumbnailPage,
    thumbnailPath
  );

  await thumbnailPage.close();

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

  await notificationService.sendJobCompletionNotification(
    jobId,
    template
  );
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
  const slideVideoPaths: string[] = [];
  const slideThumbnailPaths: string[] = [];

  // ─── Launch browser & load template (shared step, done once) ─────────────
  await updateRecordingStepPercentage(
    jobId,
    buildRecordingStepPath( RECORDING_STEPS.LAUNCHING_BROWSER.key ),
    0
  );

  await page.goto(
    `http://localhost:3000/${ template }?id=${ jobId }&capturing`,
    {
      waitUntil: "networkidle"
    }
  );

  await waitForSketchReady(
    page,
    template
  );

  await updateRecordingStepPercentage(
    jobId,
    buildRecordingStepPath( RECORDING_STEPS.LAUNCHING_BROWSER.key ),
    100
  );

  for ( let slideIndex = 0; slideIndex < slides.length; slideIndex++ ) {
    // Track which slide is being recorded
    await updateCurrentSlide(
      jobId,
      slideIndex
    );

    if ( slideIndex > 0 ) {
      // Re-navigate for subsequent slides (no dedicated step)
      await page.goto(
        `http://localhost:3000/${ template }?id=${ jobId }&capturing`,
        {
          waitUntil: "networkidle"
        }
      );

      await waitForSketchReady(
        page,
        template
      );
    }

    await page.evaluate(
      ( index ) => window.setSlide( index ),
      slideIndex
    );

    // Engine-agnostic: p5 sets data-slide on its canvas, DOM engines on their
    // capture surface element.
    await page.waitForSelector(
      `[data-slide="${ slideIndex }"]`,
      {
        timeout: 0
      }
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

    await captureFramesWithStreaming( {
      page,
      totalFrames,
      outputVideoPath: slideVideoPath,
      framerate,
      onProgress: async( percentage: number ) => {
        await updateRecordingStepPercentage(
          jobId,
          buildSlideStepPath(
            slideIndex,
            RECORDING_STEPS.ENCODING.key
          ),
          percentage
        );
      }
    } );

    // Capture thumbnail via canvas screenshot
    await captureCanvasThumbnail(
      page,
      slideThumbnailPath
    );

    slideVideoPaths.push( slideVideoPath );
    slideThumbnailPaths.push( slideThumbnailPath );
  }

  // ─── Upload all videos and thumbnails ───────────────────────────────────
  await updateRecordingStepPercentage(
    jobId,
    buildUploadStepPath( UPLOAD_STEPS.S3.key ),
    0
  );

  const videoS3Urls: string[] = [];
  const thumbnailS3Urls: string[] = [];
  const videoSizes: number[] = [];

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
    buildUploadStepPath( UPLOAD_STEPS.S3.key ),
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

  await notificationService.sendJobCompletionNotification(
    jobId,
    template
  );
}

export default recordSketch;
