import createBrowserPage from "@/utils/createBrowserPage";
import {
  captureFramesWithStreaming
} from "@/utils/captureFramesWithStreaming";
import {
  extractVideoThumbnail
} from "@/utils/extractVideoThumbnail";

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
import {
  getEffectiveSlideSettings
} from "@/lib/effectiveSlideSettings";
import {
  resolveAnimation, totalFramesFor
} from "@/lib/animationConfig";

/**
 * Wait for the sketch canvas to be ready.
 *
 * Routes (`/sketches/…`, legacy `/templates/…`) signal readiness via a
 * `[data-engine-ready]` attribute set by `EngineSketchRenderer`.
 * Legacy p5 routes use the `canvas.p5Canvas.loaded` selector.
 */
async function waitForSketchReady(
  page: Page,
  sketch: string
): Promise<void> {
  if ( /^(sketches|templates)\//.test( sketch ) ) {
    await page.waitForSelector( "[data-engine-ready]" );
  } else {
    await page.waitForSelector( "canvas.p5Canvas.loaded" );
  }
}

/**
 * Navigate to a capture page, waiting for `networkidle` exactly as before.
 *
 * Diagnostic only: this is behaviour-preserving (same wait condition, same
 * timeout, the original error is re-thrown). The single addition is that, when
 * the navigation times out waiting for the network to settle, it logs the
 * requests still in flight — the ones keeping the page from reaching
 * `networkidle`. That pinpoints the culprit (a never-finishing fetch, a
 * long-poll, a heavy asset still downloading on a slow dev server, …) so we can
 * decide the real fix from evidence instead of guessing.
 */
async function gotoSketchPage(
  page: Page,
  url: string
): Promise<void> {
  // Track requests that started but haven't completed yet.
  const inFlight = new Map<unknown, { url: string;
    method: string;
    startedAt: number }>();

  const onRequest = ( request: { url(): string;
    method(): string } ) => {
    inFlight.set(
      request,
      {
        url: request.url(),
        method: request.method(),
        startedAt: Date.now()
      }
    );
  };
  const onSettled = ( request: unknown ) => {
    inFlight.delete( request );
  };

  page.on(
    "request",
    onRequest
  );
  page.on(
    "requestfinished",
    onSettled
  );
  page.on(
    "requestfailed",
    onSettled
  );

  try {
    await page.goto(
      url,
      {
        waitUntil: "networkidle"
      }
    );
  } catch( error ) {
    const isTimeout =
      error instanceof Error &&
      ( error.name === "TimeoutError" || /Timeout/.test( error.message ) );

    if ( isTimeout ) {
      const now = Date.now();
      const pending = Array.from( inFlight.values() )
        .sort( (
          a, b
        ) => a.startedAt - b.startedAt )
        .map( ( request ) =>
          `  ${ now - request.startedAt }ms  ${ request.method }  ${ request.url }` );

      console.error( `[recordSketch] networkidle timeout for ${ url }\n` +
          `${ pending.length } request(s) still in flight (kept the page from going idle):\n` +
          ( pending.length ? pending.join( "\n" ) : "  (none — the wait timed out with no pending requests)" ) );
    }

    throw error;
  } finally {
    page.off(
      "request",
      onRequest
    );
    page.off(
      "requestfinished",
      onSettled
    );
    page.off(
      "requestfailed",
      onSettled
    );
  }
}

/**
 * Calculate total frames from animation options.
 *
 * Delegates to the shared `totalFramesFor` so the server encode loop counts
 * the exact same number of frames the engines + in-page clock derive from the
 * same animation — no more `duration || 5` here vs `duration || 10` in the
 * sketch clock, which used to make a missing/zero duration record a wrong
 * length, cut-off clip.
 */
function calculateTotalFrames( animationOptions: any ): number {
  return totalFramesFor( animationOptions );
}

/**
 * Unified recording function that handles both single and multi-slide recordings
 */
async function recordSketch(
  jobId: string,
  sketch: string,
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
        sketch,
        options,
        slides,
        recordingState.page,
        temporaryDirectoryPath
      );
    } else {
      // ─── Single recording ──────────────────────────────────────────────────
      await recordSingleSketch(
        jobId,
        sketch,
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
      sketch
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
  sketch: string,
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

  await gotoSketchPage(
    page,
    `http://localhost:3000/${ sketch }?id=${ jobId }&capturing`
  );

  await waitForSketchReady(
    page,
    sketch
  );

  await updateRecordingStepPercentage(
    jobId,
    buildRecordingStepPath( RECORDING_STEPS.LAUNCHING_BROWSER.key ),
    100
  );

  // ─── Capture frames and encode video ──────────────────────────────────────
  const totalFrames = calculateTotalFrames( options.animation );
  const framerate = resolveAnimation( options.animation ).framerate;
  const {
    size
  } = getEffectiveSlideSettings( options );
  const outputVideoPath = path.join(
    temporaryDirectoryPath,
    `${ path.basename( sketch ) }-${ size.width }x${ size.height }-${ jobId }.mp4`
  );
  const thumbnailPath = path.join(
    temporaryDirectoryPath,
    `thumbnail-${ jobId }.webp`
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

  await extractVideoThumbnail(
    outputVideoPath,
    thumbnailPath
  );

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
    videoBuffer,
    "video/mp4"
  );

  const thumbnailS3Url = await uploadArtifact(
    `${ jobId }/${ path.basename( thumbnailPath ) }`,
    await fs.readFile( thumbnailPath ),
    "image/webp"
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
    sketch
  );
}

/**
 * Record multiple slides
 */
async function recordMultipleSlides(
  jobId: string,
  sketch: string,
  options: Record<string, any>,
  slides: any[],
  page: Page,
  temporaryDirectoryPath: string
) {
  const slideVideoPaths: string[] = [];
  const slideThumbnailPaths: string[] = [];

  // ─── Launch browser & load sketch (shared step, done once) ─────────────
  await updateRecordingStepPercentage(
    jobId,
    buildRecordingStepPath( RECORDING_STEPS.LAUNCHING_BROWSER.key ),
    0
  );

  await gotoSketchPage(
    page,
    `http://localhost:3000/${ sketch }?id=${ jobId }&capturing`
  );

  await waitForSketchReady(
    page,
    sketch
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
      await gotoSketchPage(
        page,
        `http://localhost:3000/${ sketch }?id=${ jobId }&capturing`
      );

      await waitForSketchReady(
        page,
        sketch
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
    // Resolve the slide's *effective* animation (per-slide override merged
    // over the global) the same way the engines do, so a partial override
    // (e.g. framerate-only) keeps the global duration instead of dropping it —
    // and the frame count matches what the in-page clock loops over.
    const {
      size: slideSize, animation: slideAnimation
    } = getEffectiveSlideSettings(
      options,
      slideIndex
    );
    const totalFrames = calculateTotalFrames( slideAnimation );
    const framerate = resolveAnimation( slideAnimation ).framerate;

    const slideVideoPath = path.join(
      temporaryDirectoryPath,
      `${ path.basename( sketch ) }-${ slideSize.width }x${ slideSize.height }_${ slideIndex }.mp4`
    );
    const slideThumbnailPath = path.join(
      temporaryDirectoryPath,
      `thumbnail-slide-${ slideIndex }-${ jobId }.webp`
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

    await extractVideoThumbnail(
      slideVideoPath,
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
      videoBuffer,
      "video/mp4"
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
      await fs.readFile( thumbnailPath ),
      "image/webp"
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
    sketch
  );
}

export default recordSketch;
