import recordSketch from "@/lib/recordSketch";
import {
  setProgress
} from "@/lib/progressStore";

import fs from "node:fs/promises";
import path from "path";
import os from "node:os";
import recordSketchSlides from "@/lib/recordSketchSlides";

async function runRecording(
  jobId: string,
  template: string,
  formData: FormData,
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

  const captureOptions = JSON.parse( formData.get( "options" ) as string );
  const slides = captureOptions.slides ?? null;

  const assetFiles = formData.getAll( "files[]" ).filter( file => ( file as File ).size );

  // Save assets once
  captureOptions.assets = [
  ];
  captureOptions.id = jobId;

  for ( let assetFileIndex = 0; assetFileIndex < assetFiles.length; assetFileIndex++ ) {
    const assetFile = assetFiles[ assetFileIndex ];
    const fileBuffer = new Uint8Array( await ( assetFile as File ).arrayBuffer() );

    await fs.writeFile(
      path.join(
        temporaryAssetsDirectoryPath,
        ( assetFile as File ).name
      ),
      fileBuffer
    );
    captureOptions.assets.push( ( assetFile as File ).name );

    setProgress(
      jobId,
      "save-assets",
      5 + Math.round( ( assetFileIndex / assetFiles.length ) * 10 )
    );
  }

  const recordFunction = slides && Array.isArray( slides ) && slides.length > 0 ? recordSketchSlides : recordSketch;

  await recordFunction(
    jobId,
    template,
    captureOptions,
    temporaryDirectoryPath,
    temporaryAssetsDirectoryPath
  );
}

export default runRecording;