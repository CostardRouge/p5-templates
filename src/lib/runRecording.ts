import recordSketch from "@/lib/recordSketch";
import { setProgress } from "@/lib/progressStore";

import fs from "node:fs/promises";
import path from "path";
import os from "node:os";
import recordSketchSlides from "@/lib/recordSketchSlides";

export interface RecordingInput {
  options: any;
  assets: { name: string; buffer: Buffer }[];
}

async function runRecording(
  jobId: string,
  template: string,
  data: RecordingInput,
) {
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

  const temporaryAssetsDirectoryPath = path.join(
    temporaryDirectoryPath,
    "assets"
  );

  await fs.mkdir(
    temporaryAssetsDirectoryPath,
    {
      recursive: true
    }
  );

  const captureOptions = data.options;
  const slides = captureOptions.slides ?? null;

  const assetFiles = data.assets;

  // Save assets once
  captureOptions.assets = [
  ];
  captureOptions.id = jobId;

  for ( let assetFileIndex = 0; assetFileIndex < assetFiles.length; assetFileIndex++ ) {
    const assetFile = assetFiles[ assetFileIndex ];

    await fs.writeFile(
      path.join(
        temporaryAssetsDirectoryPath,
        assetFile.name
      ),
      assetFile.buffer
    );
    captureOptions.assets.push( assetFile.name );

    setProgress(
      jobId,
      "save-assets",
      5 + Math.round( ( assetFileIndex / assetFiles.length ) * 10 )
    );
  }

  const recordFunction = slides && Array.isArray( slides ) && slides.length > 0 ? recordSketchSlides : recordSketch;

  const outputPath = await recordFunction(
    jobId,
    template,
    captureOptions,
    temporaryDirectoryPath,
    temporaryAssetsDirectoryPath
  );

  return outputPath;
}

export default runRecording;