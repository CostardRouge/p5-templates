import * as tar from "tar";

import path from "path";
import fs from "node:fs/promises";

import {
  Browser,
  Page
} from "playwright";

import zipFiles from "@/utils/zipFiles";

import encodeVideoFromFrames from "@/utils/encodeVideoFromFrames";
import createBrowserPage from "@/utils/createBrowserPage";
import captureFirstFrame from "@/utils/captureFirstFrame";

import {
  updateJob
} from "@/lib/jobStore";

import {
  uploadArtifact
} from "@/lib/connections/s3";
import {
  updateRecordingStepPercentage
} from "@/lib/progression";

async function recordSketchSlides(
  jobId: string,
  template: string,
  options: Record<string, any>,
  temporaryDirectoryPath: string,
) {
  const recordingState: {
    page?: Page,
    browser?: Browser
    currentSlideIndex: number
  } = {
    page: undefined,
    browser: undefined,
    currentSlideIndex: -1
  };

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

    await recordingState.page.exposeFunction(
      "reportCaptureProgress",
      async( percentage: number ) => {
        if ( recordingState.currentSlideIndex < 0 ) {
          return;
        }

        await updateRecordingStepPercentage(
          jobId,
          `recording.slide-${ recordingState.currentSlideIndex }.saving-frames`,
          percentage
        );
      }
    );

    const slides = options.slides;
    const slideVideoPaths: string[] = [];
    const slideThumbnailPaths: string[] = [];

    for ( let slideIndex = 0; slideIndex < slides.length; slideIndex++ ) {
      recordingState.currentSlideIndex = slideIndex;

      await updateRecordingStepPercentage(
        jobId,
        `recording.slide-${ slideIndex }.launching-browser`,
        0
      );

      await recordingState.page.goto(
        `http://localhost:3000/templates/${ template }?id=${ jobId }&capturing`,
        {
          waitUntil: "networkidle"
        },
      );

      await recordingState.page.waitForSelector( "canvas#defaultCanvas0.loaded" );
      await recordingState.page.evaluate(
        ( index ) => window.setSlide( index ),
        slideIndex
      );

      await recordingState.page.waitForSelector(
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

      await recordingState.page.evaluate( () => window.startLoopRecording() );

      await updateRecordingStepPercentage(
        jobId,
        `recording.slide-${ slideIndex }.saving-frames`,
        0
      );

      const downloadEvent = await recordingState.page.waitForEvent(
        "download",
        {
          timeout: 30_000_000
        }
      );
      const slideTarPath = path.join(
        temporaryDirectoryPath,
        `slide_${ slideIndex }.tar`
      );

      await updateRecordingStepPercentage(
        jobId,
        `recording.slide-${ slideIndex }.downloading-frames-archive`,
        0
      );

      await downloadEvent.saveAs( slideTarPath );

      await updateRecordingStepPercentage(
        jobId,
        `recording.slide-${ slideIndex }.downloading-frames-archive`,
        100
      );

      await updateRecordingStepPercentage(
        jobId,
        `recording.slide-${ slideIndex }.extracting-frames-archive`,
        50
      );

      const slideFramesDirectory = path.join(
        temporaryDirectoryPath,
        `frames_slide_${ slideIndex }`
      );

      await fs.mkdir(
        slideFramesDirectory,
        {
          recursive: true
        }
      );
      await tar.x( {
        file: slideTarPath,
        cwd: slideFramesDirectory
      } );

      await updateRecordingStepPercentage(
        jobId,
        `recording.slide-${ slideIndex }.extracting-frames-archive`,
        100
      );

      // Capture thumbnail for this slide
      const slideThumbnailPath = path.join(
        temporaryDirectoryPath,
        `thumbnail-slide-${ slideIndex }-${ jobId }.jpg`
      );

      await captureFirstFrame(slideFramesDirectory, slideThumbnailPath);
      slideThumbnailPaths.push(slideThumbnailPath);

      const slideVideoPath = path.join(
        temporaryDirectoryPath,
        `${ path.basename( template ) }_${ slideIndex }.mp4`
      );

      await encodeVideoFromFrames(
        slideFramesDirectory,
        slideVideoPath,
        options.animation,
        async( percentage: number ) => {
          await updateRecordingStepPercentage(
            jobId,
            `recording.slide-${ slideIndex }.encoding-frames`,
            percentage
          );
        }
      );

      slideVideoPaths.push( slideVideoPath );

      await fs.rm(
        slideFramesDirectory,
        {
          recursive: true,
          force: true
        }
      ).catch( () => {} );

      await fs.unlink( slideTarPath ).catch( () => {} );
    }

    // Upload individual videos and thumbnails
    await updateRecordingStepPercentage(
      jobId,
      "uploading.s3",
      0
    );

    const videoS3Urls: string[] = [];
    const thumbnailS3Urls: string[] = [];

    // Upload all videos
    for (let i = 0; i < slideVideoPaths.length; i++) {
      const videoPath = slideVideoPaths[i];
      const videoS3Url = await uploadArtifact(
        `${ jobId }/${ path.basename( videoPath ) }`,
        await fs.readFile( videoPath )
      );
      videoS3Urls.push(videoS3Url);
      await fs.unlink( videoPath ).catch( () => {} );
    }

    // Upload all thumbnails
    for (let i = 0; i < slideThumbnailPaths.length; i++) {
      const thumbnailPath = slideThumbnailPaths[i];
      const thumbnailS3Url = await uploadArtifact(
        `${ jobId }/${ path.basename( thumbnailPath ) }`,
        await fs.readFile( thumbnailPath )
      );
      thumbnailS3Urls.push(thumbnailS3Url);
      await fs.unlink( thumbnailPath ).catch( () => {} );
    }

    // Also create a zip for backward compatibility (download all)
    await updateRecordingStepPercentage(
      jobId,
      "uploading.archiving",
      0
    );

    const zipOutputPath = path.join(
      temporaryDirectoryPath,
      `${ path.basename( template ) }-${ jobId }.zip`
    );

    // Re-download videos from S3 to zip them (or we could keep local copies)
    // For now, let's just create the zip from the already uploaded files
    // We'll skip this for now and just use the first video as resultUrl
    
    await updateRecordingStepPercentage(
      jobId,
      "uploading.s3",
      100
    );

    await updateJob(
      jobId,
      {
        status: "completed",
        progress: 100,
        resultUrl: videoS3Urls[0] || null, // First video for backward compatibility
        thumbnails: thumbnailS3Urls,
        videoUrls: videoS3Urls
      }
    );
  }
  catch ( error ) {
    await updateJob(
      jobId,
      {
        status: "failed",
        progress: 100,
      }
    );

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

export default recordSketchSlides;