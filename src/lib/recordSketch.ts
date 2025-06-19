import encodeVideoFromFrames from "@/utils/encodeVideoFromFrames";
import createBrowserPage from "@/utils/createBrowserPage";

import {
  updateJob
} from "@/lib/jobStore";

import {
  uploadArtifact
} from "@/lib/connections/s3";

import * as tar from "tar";

import path from "path";
import fs from "node:fs/promises";

import {
  Browser,
  Page
} from "playwright";
import {
  updateRecordingStepPercentage
} from "@/lib/progression";

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

  try {
    // ─── 5. Launch browser & load sketch ───────────────────────────────────────
    await updateRecordingStepPercentage(
      jobId,
      "recording.launching-browser",
      0
    );

    const {
      createPage,
      browser
    } = await createBrowserPage( {
      headless: true,
      deviceScaleFactor: 1
    } );

    recordingState.browser = browser;
    recordingState.page = await createPage();

    await updateRecordingStepPercentage(
      jobId,
      "recording.launching-browser",
      50
    );

    await recordingState.page.goto(
      `http://localhost:3000/templates/${ template }?id=${ jobId }`,
      {
        waitUntil: "networkidle"
      },
    );

    await recordingState.page.waitForSelector( "canvas#defaultCanvas0.loaded" );

    await updateRecordingStepPercentage(
      jobId,
      "recording.launching-browser",
      100
    );

    // ─── 6. Capture frames ─────────────────────────────────────────────────────
    await recordingState.page.exposeFunction(
      "reportCaptureProgress",
      async( percentage: number ) => {
        await updateRecordingStepPercentage(
          jobId,
          "recording.saving-frames",
          percentage
        );
      }
    );

    // @ts-ignore
    await recordingState.page.evaluate( () => window.startLoopRecording() );

    await updateRecordingStepPercentage(
      jobId,
      "recording.saving-frames",
      0
    );

    const downloadEvent = await recordingState.page.waitForEvent(
      "download",
      {
        timeout: 30_000_000
      }
    );
    const tarPath = path.join(
      temporaryDirectoryPath,
      downloadEvent.suggestedFilename()
    );

    // await updateRecordingStepPercentage(
    //   jobId,
    //   "recording.downloading-frames-archive",
    //   0
    // );

    await downloadEvent.saveAs( tarPath );

    await updateRecordingStepPercentage(
      jobId,
      "recording.downloading-frames-archive",
      100
    );
    await recordingState.page.close();

    // ─── 7. Extract frames ───────────────────────────────────────────────────────
    await updateRecordingStepPercentage(
      jobId,
      "recording.extracting-frames-archive",
      50
    );

    const tarExtractionPath = path.join(
      temporaryDirectoryPath,
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

    await updateRecordingStepPercentage(
      jobId,
      "recording.extracting-frames-archive",
      100
    );

    // ─── 8. Encode .mp4 ──────────────────────────────────────────────────────────
    const outputVideoPath = path.join(
      temporaryDirectoryPath,
      `${ path.basename( template ) }-${ jobId }.mp4`
    );

    await encodeVideoFromFrames(
      tarExtractionPath,
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

    await fs.rm(
      tarExtractionPath,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );

    await fs.unlink( tarPath ).catch( () => {} );

    // ─── 9. Upload final .mp4 to S3 ──────────────────────────────────────────────
    await updateRecordingStepPercentage(
      jobId,
      "uploading",
      0
    );

    const videoS3Url = await uploadArtifact(
      `${ jobId }/${ path.basename( outputVideoPath ) }`,
      await fs.readFile( outputVideoPath )
    );

    // ─── 10. Mark job done in DB ─────────────────────────────────────────────────
    await updateRecordingStepPercentage(
      jobId,
      "uploading",
      100
    );
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
    await updateJob(
      jobId,
      {
        status: "failed",
        progress: 100
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

export default recordSketch;