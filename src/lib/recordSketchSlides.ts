import {
  setProgress
} from "@/lib/progressStore";

import zipFiles from "@/lib/zipFiles";

import minifyAndEncode from "@/utils/minifyAndEncodeCaptureOptions";
import encodeVideoFromFrames from "@/lib/encodeVideoFromFrames";
import createBrowserPage from "@/utils/createBrowserPage";

import * as tar from "tar";

import path from "path";
import fs from "node:fs/promises";

import {
  Page
} from "playwright";

async function recordSketchSlides(
  jobId: string,
  template: string,
  captureOptions: any,
  temporaryDirectory: string,
  temporaryAssetsDirectoryPath: string,
) {
  const recordingState: {
    page?: Page
  } = {
    page: undefined
  };

  console.log( {
    temporaryDirectory
  } );

  try {
    const {
      createPage
    } = await createBrowserPage( {
      headless: false,
      deviceScaleFactor: 1
    } );

    const slides = captureOptions.slides;
    const slideVideos: string[] = [
    ];

    for ( let slideIndex = 0; slideIndex < slides.length; slideIndex++ ) {
      const slideProgressBase = ( slideIndex / slides.length ) * 90;

      setProgress(
        jobId,
        `slide-${ slideIndex }-browser`,
        slideProgressBase + 5
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

      await recordingState.page.exposeFunction(
        "reportCaptureProgress",
        ( percentage: number ) => {
          setProgress(
            jobId,
            `slide-${ slideIndex }-capturing`,
            slideProgressBase + 15 + percentage * 40
          );
        }
      );

      setProgress(
        jobId,
        `slide-${ slideIndex }-capturing`,
        slideProgressBase + 15
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
        temporaryDirectory,
        `slide_${ slideIndex }.tar`
      );

      await downloadEvent.saveAs( slideTarPath );
      await recordingState.page.close();

      setProgress(
        jobId,
        `slide-${ slideIndex }-extracting`,
        slideProgressBase + 60
      );

      const slideFramesDirectory = path.join(
        temporaryDirectory,
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
        temporaryDirectory,
        `${ template }_${ slideIndex }.mp4`
      );

      await encodeVideoFromFrames(
        slideFramesDirectory,
        slideVideoPath,
        captureOptions.animation,
        ( percentage: number ) => {
          setProgress(
            jobId,
            `slide-${ slideIndex }-encoding`,
            slideProgressBase + 60 + percentage * 20
          );
        }
      );

      slideVideos.push( slideVideoPath );

      await fs.rm(
        slideFramesDirectory,
        {
          recursive: true,
          force: true
        }
      ).catch( () => {} );

      await fs.unlink( slideTarPath ).catch( () => {} );
    }

    await fs.rm(
      temporaryAssetsDirectoryPath,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );

    setProgress(
      jobId,
      "zipping-slides",
      95
    );

    const zipOutputPath = path.join(
      temporaryDirectory,
      `${ template }_${ jobId }.zip`
    );

    await zipFiles(
      slideVideos,
      zipOutputPath
    );

    for ( const slideVideoPath of slideVideos ) {
      await fs.unlink( slideVideoPath ).catch( () => {} );
    }

    setProgress(
      jobId,
      "done",
      100
    );
  }
  catch ( error ) {
    setProgress(
      jobId,
      "error",
      100
    );

    await recordingState?.page?.close();
    await fs.rm(
      temporaryDirectory,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );

    throw error;
  }
}

export default recordSketchSlides;