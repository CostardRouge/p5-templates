import fs from "node:fs";
import path from "node:path";
import {
  resolveSketchPath
} from "@/engines/metadata";

function getSketchDir(
  sketchName: string, engineId: string
): string | null {
  const sketchPath = resolveSketchPath(
    sketchName,
    engineId
  );

  if ( !sketchPath ) return null;

  return path.join(
    process.cwd(),
    "src",
    "templates",
    engineId,
    "sketches",
    sketchPath
  );
}

export async function GET( request: Request ) {
  if ( process.env.NODE_ENV === "production" ) {
    return new Response(
      "Not found",
      {
        status: 404,
      }
    );
  }

  const {
    searchParams
  } = new URL( request.url );
  const sketchName = searchParams.get( "sketch" );
  const engineId = searchParams.get( "engine" );

  if ( !sketchName || !engineId ) {
    return new Response(
      "Missing sketch or engine param",
      {
        status: 400,
      }
    );
  }

  const sketchDir = getSketchDir(
    sketchName,
    engineId
  );

  if ( !sketchDir || !fs.existsSync( sketchDir ) ) {
    return new Response(
      "Sketch not found",
      {
        status: 404,
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream( {
    start( controller ) {
      // Send an initial ping so the client knows the connection is open
      controller.enqueue( encoder.encode( ": connected\n\n" ) );

      const watcher = fs.watch(
        sketchDir,
        {
          recursive: true,
        },
        (
          _eventType, filename
        ) => {
          const payload = JSON.stringify( {
            filename: filename ?? "",
          } );

          controller.enqueue( encoder.encode( `data: ${ payload }\n\n` ) );
        }
      );

      request.signal.addEventListener(
        "abort",
        () => {
          watcher.close();
          controller.close();
        }
      );
    },
  } );

  return new Response(
    stream,
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }
  );
}
