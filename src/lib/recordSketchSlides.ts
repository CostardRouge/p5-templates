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

import {
  updateJob
} from "@/lib/jobStore";

import {
  uploadArtifact
} from "@/lib/connections/s3";
import {
  updateRecordingStepPercentage
} from "@/lib/progression";
import sleep from "@/utils/sleep";

async function recordSketchSlides(
  jobId: string,
  template: string,
  options: Record<string, any>,
  temporaryDirectoryPath: string,
) {
  const recordingState: {
    page?: Page,
    browser?: Browser
  } = {
    page: undefined
  };

  try {
    const {
      createPage,
      browser
    } = await createBrowserPage( {
      headless: false,
      deviceScaleFactor: 1
    } );

    recordingState.browser = browser;

    const slides = options.slides;
    const slideVideoPaths: string[] = [
    ];

    for ( let slideIndex = 0; slideIndex < slides.length; slideIndex++ ) {
      await updateRecordingStepPercentage(
        jobId,
        `recording.slide-${ slideIndex }.launching-browser`,
        0
      );

      if ( !recordingState.page ) {
        recordingState.page = await createPage();

        await recordingState.page.exposeFunction(
          "reportCaptureProgress",
          async( percentage: number ) => {
            await updateRecordingStepPercentage(
              jobId,
              `recording.slide-${ slideIndex }.saving-frames`,
              percentage
            );
          }
        );
      }

      await recordingState.page.goto(
        `http://localhost:3000/templates/${ template }?id=${ jobId }`,
        {
          waitUntil: "networkidle"
        },
      );

      await recordingState.page.waitForSelector( "canvas#defaultCanvas0.loaded" );
      await recordingState.page.evaluate(
        ( index ) => window.setSlide( index ),
        slideIndex
      );

      await sleep( 1000 );

      await updateRecordingStepPercentage(
        jobId,
        `recording.slide-${ slideIndex }.launching-browser`,
        100
      );

      // @ts-ignore
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

      // await recordingState.page.close();

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

    await updateRecordingStepPercentage(
      jobId,
      "uploading.archiving",
      0
    );

    const zipOutputPath = path.join(
      temporaryDirectoryPath,
      `${ path.basename( template ) }-${ jobId }.zip`
    );

    await zipFiles(
      slideVideoPaths,
      zipOutputPath
    );

    await updateRecordingStepPercentage(
      jobId,
      "uploading.archiving",
      100
    );

    for ( const slideVideoPath of slideVideoPaths ) {
      await fs.unlink( slideVideoPath ).catch( () => {} );
    }

    await updateRecordingStepPercentage(
      jobId,
      "uploading.s3",
      0
    );

    const zipS3Url = await uploadArtifact(
      `${ jobId }/${ path.basename( zipOutputPath ) }`,
      await fs.readFile( zipOutputPath )
    );

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
        resultUrl: zipS3Url
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