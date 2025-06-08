import * as tar from "tar";

import path from "path";
import fs from "node:fs/promises";

import {
  Page
} from "playwright";

import {
  setProgress
} from "@/lib/progressStore";

import zipFiles from "@/lib/zipFiles";

import minifyAndEncode from "@/utils/minifyAndEncodeCaptureOptions";
import encodeVideoFromFrames from "@/lib/encodeVideoFromFrames";
import createBrowserPage from "@/utils/createBrowserPage";

import {
  updateJob
} from "@/lib/jobStore";

import {
  uploadArtifact
} from "@/lib/s3";

async function recordSketchSlides(
  jobId: string,
  template: string,
  captureOptions: any,
  temporaryDirectoryPath: string,
) {
  const recordingState: {
    page?: Page
  } = {
    page: undefined
  };

  try {
    const {
      createPage
    } = await createBrowserPage( {
      headless: true,
      deviceScaleFactor: 1
    } );

    const slides = captureOptions.slides;
    const slideVideoPaths: string[] = [
    ];

    for ( let slideIndex = 0; slideIndex < slides.length; slideIndex++ ) {
      const slideProgressBase = ( slideIndex / slides.length ) * 90;

      // ─── 6.1 Launch browser for this slide ───────────────────────────────────
      await setProgress(
        jobId,
        `slide-${ slideIndex }-browser`,
        15 + slideProgressBase
      );

      recordingState.page = await createPage();

      await recordingState.page.goto(
        `http://localhost:3000/p5/${ template }?captureOptions=${ minifyAndEncode( captureOptions ) }`,
        {
          waitUntil: "networkidle"
        },
      );

      await recordingState.page.waitForSelector( "canvas#defaultCanvas0.loaded" );
      await recordingState.page.evaluate(
        // @ts-ignore
        ( index ) => window.setSlide( index ),
        slideIndex
      );

      await setProgress(
        jobId,
        `slide-${ slideIndex }-capturing`,
        slideProgressBase + 15
      );

      // ─── 6.2 Capture frames for this slide ──────────────────────────────────
      await recordingState.page.exposeFunction(
        "reportCaptureProgress",
        async( percentage: number ) => {
          await setProgress(
            jobId,
            `slide-${ slideIndex }-capturing`,
            slideProgressBase + 15 + percentage * 40
          );
        }
      );

      // @ts-ignore
      await recordingState.page.evaluate( () => window.startLoopRecording() );

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

      await downloadEvent.saveAs( slideTarPath );
      await recordingState.page.close();

      // ─── 6.3 Extract and encode this slide ─────────────────────────────────
      await setProgress(
        jobId,
        `slide-${ slideIndex }-extracting`,
        slideProgressBase + 60
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

      const slideVideoPath = path.join(
        temporaryDirectoryPath,
        `${ template }_${ slideIndex }.mp4`
      );

      await encodeVideoFromFrames(
        slideFramesDirectory,
        slideVideoPath,
        captureOptions.animation,
        async( percentage: number ) => {
          await setProgress(
            jobId,
            `slide-${ slideIndex }-encoding`,
            slideProgressBase + 60 + percentage * 20
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

    // ─── 7. Bundle all .mp4s into ZIP ───────────────────────────────────────────
    await setProgress(
      jobId,
      "zipping-slides",
      95
    );

    const zipOutputPath = path.join(
      temporaryDirectoryPath,
      `${ template }-${ jobId }.zip`
    );

    await zipFiles(
      slideVideoPaths,
      zipOutputPath
    );

    for ( const slideVideoPath of slideVideoPaths ) {
      await fs.unlink( slideVideoPath ).catch( () => {} );
    }

    // ─── 8. Upload ZIP to S3 ───────────────────────────────────────────────────
    await setProgress(
      jobId,
      "upload-zip",
      95
    );

    const zipS3Url = await uploadArtifact(
      jobId,
      zipOutputPath
    );

    await updateJob(
      jobId,
      {
        status: "completed",
        progress: 100,
        resultUrl: zipS3Url
      }
    );

    await fs.rm(
      temporaryDirectoryPath,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );
  }
  catch ( error ) {
    await setProgress(
      jobId,
      "error",
      100
    );

    await recordingState?.page?.close();
    await fs.rm(
      temporaryDirectoryPath,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );

    throw error;
  }
}

export default recordSketchSlides;