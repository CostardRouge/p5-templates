// import recordSketch from "@/lib/recordSketch";
// import recordSketchSlides from "@/lib/recordSketchSlides";

import {
  updateJob, getJobById
} from "@/lib/jobStore";

import fs from "node:fs/promises";
import path from "path";
import os from "node:os";

import getCaptureOptions from "@/utils/getCaptureOptions";
import {
  addRecordingSteps
} from "@/lib/progression";
import {
  getRecordingSketchStepsByOptions
} from "@/lib/progression/steps";

async function runRecording( jobId: string ) {
  if ( process.env.NODE_ENV === "production" && process.env.ENABLE_VIDEO_GENERATION === "false" ) {
    return;
  }

  const recordSketch = await import( "@/lib/recordSketch" );
  const recordSketchSlides = await import( "@/lib/recordSketchSlides" );

  console.log(
    recordSketch,
    recordSketchSlides
  );

  // ─── 1. Create workspace ───────────────────────────────────────────────────
  const temporaryDirectoryPath = path.join(
    os.tmpdir(),
    jobId
  );

  await fs.mkdir(
    temporaryDirectoryPath,
    {
      recursive: true
    }
  );

  try {
    const persistedJob = await getJobById( jobId );

    if ( !persistedJob ) {
      throw new Error( `[runRecording.ts] Job ${ jobId } not found` );
    }

    const options = await getCaptureOptions( `${ jobId }/options.json` );

    // ─── 4. Decide single vs multiple slides ──────────────────────────────────
    // @ts-ignore
    const slides = options.slides ?? null;
    const recordFunction = slides && Array.isArray( slides ) && slides.length > 0 ? recordSketchSlides : recordSketch;

    // ─── 5. Update progression ──────────────────────────────────
    await addRecordingSteps(
      jobId,
      getRecordingSketchStepsByOptions( options ),
      persistedJob.status
    );

    console.log(
      "recordFunction",
      recordFunction
    );

    // @ts-ignore
    await recordFunction(
      jobId,
      persistedJob.template,
      options,
      temporaryDirectoryPath
    );
  }
  catch ( error ) {
    // If anything fails, mark job as failed and rethrow
    await updateJob(
      jobId,
      {
        status: "failed",
        progress: 100
      }
    );
    throw error;
  }
}

export default runRecording;