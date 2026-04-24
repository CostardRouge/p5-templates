import fs from "node:fs";
import path from "node:path";
import {
  resolveSketchPath
} from "@/engines/metadata";

function getSketchDir( sketchName: string ): string {
  const sketchPath = resolveSketchPath( sketchName );

  return path.join(
    process.cwd(),
    "src",
    "p5-sketches",
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

  if ( !sketchName ) {
    return new Response(
      "Missing sketch param",
      {
        status: 400,
      }
    );
  }

  const sketchDir = getSketchDir( sketchName );

  if ( !fs.existsSync( sketchDir ) ) {
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
