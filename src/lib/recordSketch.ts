import {
  setProgress
} from "@/lib/progressStore";

import minifyAndEncode from "@/utils/minifyAndEncodeCaptureOptions";
import encodeVideoFromFrames from "@/lib/encodeVideoFromFrames";
import createBrowserPage from "@/utils/createBrowserPage";

import {
  updateJob
} from "@/lib/jobStore";

import {
  uploadArtifact
} from "@/lib/s3";

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
    // ─── 5. Launch browser & load sketch ───────────────────────────────────────
    await setProgress(
      jobId,
      "launch-browser",
      15
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

    // ─── 6. Capture frames ─────────────────────────────────────────────────────
    await recordingState.page.exposeFunction(
      "reportCaptureProgress",
      async( percentage: number ) => {
        await setProgress(
          jobId,
          "capturing-frames",
          15 + percentage * 50
        );
      }
    );

    await setProgress(
      jobId,
      "starting-capture",
      65
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

    await setProgress(
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

    // ─── 7. Extract frames ───────────────────────────────────────────────────────
    await setProgress(
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

    // ─── 8. Encode .mp4 ──────────────────────────────────────────────────────────
    const outputVideoPath = path.join(
      temporaryDirectory,
      `${ template }_${ jobId }.mp4`
    );

    await encodeVideoFromFrames(
      tarExtractionPath,
      outputVideoPath,
      captureOptions.animation,
      async( percentage ) => {
        await setProgress(
          jobId,
          "encoding",
          75 + percentage * 20
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

    // ─── 9. Upload final .mp4 to S3 ──────────────────────────────────────────────
    await setProgress(
      jobId,
      "saving-result",
      99
    );

    const videoS3Url = await uploadArtifact(
      jobId,
      outputVideoPath
    );

    // ─── 10. Mark job done in DB ─────────────────────────────────────────────────
    await updateJob(
      jobId,
      {
        status: "completed",
        progress: 100,
        resultUrl: videoS3Url
      }
    );
  }
  catch ( error ) {
    await setProgress(
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