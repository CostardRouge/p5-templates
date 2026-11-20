import fs from "node:fs/promises";
import path from "node:path";

import {
  ASSETS_DIRECTORY
} from "@/constants";
import {
  findSketchMeta
} from "@/engines/metadata";
import {
  writeThumbnail
} from "@/utils/captureCanvasThumbnail";

const THUMBNAIL_VARIANTS = [
  {
    suffix: "",
    width: 360,
    height: 450
  },
  {
    suffix: "-2x",
    width: 720,
    height: 900
  }
] as const;
const THUMBNAIL_QUALITY = 80;

export async function POST( request: Request ) {
  if ( process.env.NODE_ENV === "production" ) {
    return new Response(
      "Not found",
      {
        status: 404
      }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return new Response(
      "Invalid JSON body",
      {
        status: 400
      }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof ( body as Record<string, unknown> ).sketch !== "string" ||
    typeof ( body as Record<string, unknown> ).engineId !== "string" ||
    typeof ( body as Record<string, unknown> ).imagePngBase64 !== "string"
  ) {
    return new Response(
      "Missing required fields: sketch (string), engineId (string), imagePngBase64 (string)",
      {
        status: 400
      }
    );
  }

  const {
    sketch, engineId, imagePngBase64
  } = body as {
    sketch: string;
    engineId: string;
    imagePngBase64: string;
  };

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

  const cleaned = imagePngBase64.replace(
    /^data:image\/png;base64,/,
    ""
  );
  const buffer = Buffer.from(
    cleaned,
    "base64"
  );

  if ( buffer.length === 0 ) {
    return new Response(
      "Decoded image buffer is empty",
      {
        status: 400
      }
    );
  }

  const thumbnailDir = `${ ASSETS_DIRECTORY }/images/templates/${ engineId }/${ sketch }`;

  try {
    for ( const {
      suffix, width, height
    } of THUMBNAIL_VARIANTS ) {
      await writeThumbnail(
        buffer,
        `${ thumbnailDir }/thumbnail${ suffix }.webp`,
        {
          format: "webp",
          quality: THUMBNAIL_QUALITY,
          resize: {
            width,
            height,
            fit: "cover"
          }
        }
      );
    }

    const metadataPath = path.join(
      process.cwd(),
      "src/sketches/metadata.json"
    );
    const raw = await fs.readFile(
      metadataPath,
      "utf-8"
    );
    const entries = JSON.parse( raw ) as Array<Record<string, unknown>>;
    const entry = entries.find( ( e ) => e.name === sketch );

    if ( entry && entry.hasThumbnail !== true ) {
      entry.hasThumbnail = true;
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
  }

  return Response.json( {
    ok: true
  } );
}
