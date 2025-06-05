import {
  setProgress
} from "@/lib/progressStore";

import minifyAndEncode from "@/utils/minifyAndEncodeCaptureOptions";
import encodeVideoFromFrames from "@/lib/encodeVideoFromFrames";
import createBrowserPage from "@/utils/createBrowserPage";

import * as tar from "tar";

import path from "path";
import fs from "node:fs/promises";

import {
  Page
} from "playwright";

async function recordSketch(
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

  try {
    setProgress(
      jobId,
      "launch-browser",
      10
    );

    const {
      createPage
    } = await createBrowserPage( {
      headless: true,
      deviceScaleFactor: 1
    } );

    recordingState.page = await createPage();

    await recordingState.page.goto(
      `http://localhost:3000/p5/${ template }?captureOptions=${ minifyAndEncode( captureOptions ) }`,
      {
        waitUntil: "networkidle"
      },
    );

    await recordingState.page.waitForSelector( "canvas#defaultCanvas0.loaded" );

    await recordingState.page.exposeFunction(
      "reportCaptureProgress",
      ( percentage: number ) => {
        setProgress(
          jobId,
          "capturing-frames",
          20 + percentage * 50
        );
      }
    );

    setProgress(
      jobId,
      "starting-capture",
      20
    );

    // @ts-ignore
    await recordingState.page.evaluate( () => window.startLoopRecording() );

    const downloadEvent = await recordingState.page.waitForEvent(
      "download",
      {
        timeout: 30_000_000
      }
    );
    const tarPath = path.join(
      temporaryDirectory,
      downloadEvent.suggestedFilename()
    );

    setProgress(
      jobId,
      "download-frames",
      70
    );

    await downloadEvent.saveAs( tarPath );
    await recordingState.page.close();

    await fs.rm(
      temporaryAssetsDirectoryPath,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );

    setProgress(
      jobId,
      "extract-frames",
      75
    );

    const tarExtractionPath = path.join(
      temporaryDirectory,
      "frames"
    );

    await fs.mkdir(
      tarExtractionPath,
      {
        recursive: true
      }
    );

    await tar.x( {
      file: tarPath,
      cwd: tarExtractionPath
    } );

    const outputVideoPath = path.join(
      temporaryDirectory,
      `${ template }_${ jobId }.mp4`
    );

    await encodeVideoFromFrames(
      tarExtractionPath,
      outputVideoPath,
      captureOptions.animation,
      percentage => {
        setProgress(
          jobId,
          "encoding",
          75 + percentage * 24
        );
      }
    );

    await fs.rm(
      tarExtractionPath,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );

    await fs.unlink( tarPath ).catch( () => {} );

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

export default recordSketch;