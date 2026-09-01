import fs from "node:fs";
import path from "node:path";
import {
  parseHandClip,
  serializeHandClip
} from "@/p5/shared/handClip.js";

// Dev-only: writes a baked `p5t-handclip` straight into the shared clip
// library (`src/sketches/p5/shared/handClips/`), so a take recorded in the
// hand-clip studio lands in the repo with one key press instead of a
// download + drag. Same posture as `/api/dev/save-defaults`, which rewrites a
// sketch's options.ts on disk: 404 in production, no auth, local tree only.

const CLIPS_DIR = path.join(
  process.cwd(),
  "src",
  "sketches",
  "p5",
  "shared",
  "handClips"
);

function slugOf( name: string ): string {
  return name
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}

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

  const clipSource = ( body as Record<string, unknown> | null )?.clip;

  if ( !clipSource || typeof clipSource !== "object" ) {
    return new Response(
      "Missing required field: clip (a p5t-handclip payload)",
      {
        status: 400
      }
    );
  }

  // Round-trip through the format module: rejects anything that is not a
  // valid clip and normalises what we write (derived fields, quantization).
  let clip;

  try {
    clip = parseHandClip( clipSource );
  } catch( error ) {
    return new Response(
      String( error ),
      {
        status: 422
      }
    );
  }

  const slug = slugOf( clip.name );

  if ( !slug ) {
    return new Response(
      "Clip name yields an empty filename",
      {
        status: 422
      }
    );
  }

  const filename = `${ slug }.json`;
  const target = path.join(
    CLIPS_DIR,
    filename
  );

  // Belt and braces: the slug can't contain separators, but never write
  // outside the library directory.
  if ( path.dirname( target ) !== CLIPS_DIR ) {
    return new Response(
      "Invalid clip name",
      {
        status: 422
      }
    );
  }

  fs.mkdirSync(
    CLIPS_DIR,
    {
      recursive: true
    }
  );
  fs.writeFileSync(
    target,
    serializeHandClip( clip ) + "\n",
    "utf-8"
  );

  return new Response(
    JSON.stringify( {
      ok: true,
      file: path.relative(
        process.cwd(),
        target
      ),
      frameCount: clip.frameCount
    } ),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
