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

import recordSketch from "@/lib/recordSketch";
import recordSketchSlides from "@/lib/recordSketchSlides";

async function runRecording( jobId: string ) {
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
    const slides = options.slides ?? null;
    const recordFunction = slides && Array.isArray( slides ) && slides.length > 0 ? recordSketchSlides : recordSketch;

    // ─── 5. Update progression ──────────────────────────────────
    await addRecordingSteps(
      jobId,
      getRecordingSketchStepsByOptions( options ),
      persistedJob.status
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