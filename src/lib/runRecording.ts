import recordSketch from "@/lib/recordSketch";
import {
  setProgress
} from "@/lib/progressStore";
import {
  updateJob
} from "@/lib/jobStore";

import fs from "node:fs/promises";
import path from "path";
import os from "node:os";

import {
  uploadArtifact
} from "@/lib/s3";
import recordSketchSlides from "@/lib/recordSketchSlides";

async function runRecording(
  jobId: string,
  template: string,
  formData: Record<string, unknown>,
) {
  // ─── 1. Create workspace ───────────────────────────────────────────────────
  const temporaryDirectoryPath = path.join(
    os.tmpdir(),
    jobId
  );

  const temporaryAssetsDirectoryPath = path.join(
    temporaryDirectoryPath,
    "assets"
  );

  await fs.mkdir(
    temporaryDirectoryPath,
    {
      recursive: true
    }
  );

  try {
    // ─── 2. Parse and write options.json ──────────────────────────────────────
    await setProgress(
      jobId,
      "parse-options",
      5
    );

    const captureOptions = JSON.parse( formData.options as string );

    captureOptions.assets = [
    ];
    captureOptions.id = jobId;

    // Write the raw options JSON to disk
    const optionsPath = path.join(
      temporaryDirectoryPath,
      "options.json"
    );

    await fs.writeFile(
      optionsPath,
      JSON.stringify(
        captureOptions,
        null,
        2
      )
    );

    const optionsS3Url = await uploadArtifact(
      jobId,
      optionsPath
    );

    await updateJob(
      jobId,
      {
        optionsKey: optionsS3Url
      }
    );

    // ─── 3. Save any new files[] passed in the initial payload ────────────────
    const incomingFiles = ( formData.files as Array<{
 name: string; base64Content: string
}> ) || [
    ];

    for ( let assetFileIndex = 0; assetFileIndex < incomingFiles.length; assetFileIndex++ ) {
      const incomingFile = incomingFiles[ assetFileIndex ];
      const fileBuffer = Buffer.from(
        incomingFile.base64Content.split( "," )[ 1 ],
        "base64"
      );

      await fs.writeFile(
        path.join(
          temporaryAssetsDirectoryPath,
          incomingFile.name
        ),
        fileBuffer
      );

      captureOptions.assets.push( incomingFile.name );

      await setProgress(
        jobId,
        "save-assets",
        5 + Math.round( ( assetFileIndex / incomingFiles.length ) * 10 )
      );
    }

    // ─── 4. Decide single vs multiple slides ──────────────────────────────────
    const slides = captureOptions.slides ?? null;
    const recordFunction = slides && Array.isArray( slides ) && slides.length > 0 ? recordSketchSlides : recordSketch;

    await recordFunction(
      jobId,
      template,
      captureOptions,
      temporaryDirectoryPath,
      temporaryAssetsDirectoryPath
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