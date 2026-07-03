import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import {
  ASSETS_DIRECTORY
} from "@/constants";
import {
  findSketchMeta
} from "@/engines/metadata";
import encodePreviewFromVideo from "@/lib/encodePreviewFromVideo";
import {
  PREVIEW_VARIANTS
} from "@/lib/previewConfig";

/**
 * Dev-only. Accepts a "Record preview" capture (a WebM/MP4 blob) from either
 * the realtime or the async-loop flavour, re-encodes it into the sketch's
 * committed preview variants on disk and flags `hasPreview` in metadata.
 * Nothing is returned to the browser — the author reviews the written files
 * and decides whether to commit them.
 */
export async function POST( request: Request ) {
  if ( process.env.NODE_ENV === "production" ) {
    return new Response(
      "Not found",
      {
        status: 404
      }
    );
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return new Response(
      "Invalid form data",
      {
        status: 400
      }
    );
  }

  const sketch = form.get( "sketch" );
  const engineId = form.get( "engineId" );
  const video = form.get( "video" );

  if (
    typeof sketch !== "string" ||
    typeof engineId !== "string" ||
    !( video instanceof File )
  ) {
    return new Response(
      "Missing required fields: sketch (string), engineId (string), video (file)",
      {
        status: 400
      }
    );
  }

  if ( !findSketchMeta(
    sketch,
    engineId
  ) ) {
    return new Response(
      `Sketch "${ sketch }" not found in metadata`,
      {
        status: 404
      }
    );
  }

  const buffer = Buffer.from( await video.arrayBuffer() );

  if ( buffer.length === 0 ) {
    return new Response(
      "Uploaded video is empty",
      {
        status: 400
      }
    );
  }

  const outputDir = `${ ASSETS_DIRECTORY }/images/templates/${ engineId }/${ sketch }`;
  const tmpDir = await fs.mkdtemp( path.join(
    os.tmpdir(),
    `preview-rec-${ sketch }-`
  ) );
  const tmpInput = path.join(
    tmpDir,
    "recording.webm"
  );

  try {
    await fs.writeFile(
      tmpInput,
      buffer
    );
    await fs.mkdir(
      outputDir,
      {
        recursive: true
      }
    );

    for ( const variant of PREVIEW_VARIANTS ) {
      await encodePreviewFromVideo(
        tmpInput,
        `${ outputDir }/${ variant.filename }`,
        {
          width: variant.width,
          height: variant.height
        }
      );
    }

    const metadataPath = path.join(
      process.cwd(),
      "src/templates/metadata.json"
    );
    const raw = await fs.readFile(
      metadataPath,
      "utf-8"
    );
    const entries = JSON.parse( raw ) as Array<Record<string, unknown>>;
    const entry = entries.find( ( e ) => e.name === sketch );

    if ( entry && entry.hasPreview !== true ) {
      entry.hasPreview = true;
      await fs.writeFile(
        metadataPath,
        JSON.stringify(
          entries,
          null,
          2
        ),
        "utf-8"
      );
    }
  } catch( err ) {
    return new Response(
      err instanceof Error ? err.message : String( err ),
      {
        status: 500
      }
    );
  } finally {
    await fs.rm(
      tmpDir,
      {
        recursive: true,
        force: true
      }
    ).catch( () => {} );
  }

  return Response.json( {
    ok: true
  } );
}
