import createSketchThumbnails from "@/lib/createSketchThumbnails";
import {
  findSketchMeta
} from "@/engines/metadata";

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
    typeof ( body as Record<string, unknown> ).engineId !== "string"
  ) {
    return new Response(
      "Missing required fields: sketch (string), engineId (string)",
      {
        status: 400
      }
    );
  }

  const {
    sketch, engineId
  } = body as { sketch: string;
    engineId: string };

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

  try {
    await createSketchThumbnails( {
      targetSketch: {
        name: sketch,
        engineId
      },
      overwrite: true
    } );
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
