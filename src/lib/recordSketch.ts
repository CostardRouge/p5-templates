import encodeVideoFromFrames from "@/utils/encodeVideoFromFrames";
import createBrowserPage from "@/utils/createBrowserPage";
import captureFirstFrame from "@/utils/captureFirstFrame";
import { captureFramesServerSide } from "@/utils/captureFramesServerSide";

import {
  updateJob
} from "@/lib/jobStore";

import {
  uploadArtifact
} from "@/lib/connections/s3";

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
      `http://localhost:3000/templates/${ template }?id=${ jobId }&amp;capturing`,
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

    // ─── 6. Capture frames server-side ─────────────────────────────────────────
    await updateRecordingStepPercentage(
      jobId,
      "recording.saving-frames",
      0
    );

    const framesDirectory = path.join(
      temporaryDirectoryPath,
      "frames"
    );

    // Get total frames count from animation options
    const totalFrames = options.animation?.maximumFramesCount || 
                       (options.animation?.duration || 5) * (options.animation?.framerate || 60);

    // Capture frames directly on the server
    await captureFramesServerSide({
      page: recordingState.page,
      framesDirectory,
      totalFrames,
      onProgress: async (percentage: number) => {
        await updateRecordingStepPercentage(
          jobId,
          "recording.saving-frames",
          percentage
        );
      },
    });

    await recordingState.page.close();

    // ─── 7. Capture first frame as thumbnail ──────────────────────────────────
    const thumbnailPath = path.join(
      temporaryDirectoryPath,
      `thumbnail-${ jobId }.jpg`
    );

    await captureFirstFrame(framesDirectory, thumbnailPath);

    // ─── 8. Encode .mp4 ──────────────────────────────────────────────────────────
    const outputVideoPath = path.join(
      temporaryDirectoryPath,
      `${ path.basename( template ) }-${ jobId }.mp4`
    );

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

    await fs.rm(
      framesDirectory,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );

    // ─── 9. Upload final .mp4 and thumbnail to S3 ────────────────────────────────
    await updateRecordingStepPercentage(
      jobId,
      "uploading",
      0
    );

    const videoS3Url = await uploadArtifact(
      `${ jobId }/${ path.basename( outputVideoPath ) }`,
      await fs.readFile( outputVideoPath )
    );

    const thumbnailS3Url = await uploadArtifact(
      `${ jobId }/${ path.basename( thumbnailPath ) }`,
      await fs.readFile( thumbnailPath )
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
        resultUrl: videoS3Url,
        thumbnails: [thumbnailS3Url],
        videoUrls: [videoS3Url]
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