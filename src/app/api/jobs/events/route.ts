// app/api/jobs/events/route.ts
import {
  recordingQueue as recordQueue
} from "@/lib/recordQueue";
import {
  NextResponse
} from "next/server";

export async function GET() {
  const stream = new ReadableStream( {
    start( controller ) {
      const onProgress = (
        jobId: any, progress: number | object
      ) => {
        console.log( {
          jobId,
          progress
        } );
        // The first argument is jobId, second is progress
        controller.enqueue( `data: ${ JSON.stringify( {
          jobId,
          progress
        } ) }\n\n` );
      };

      recordQueue.on(
        "progress",
        onProgress
      );
    }
  } );

  return new NextResponse(
    stream,
    {
      headers: {
        "Content-Type": "text/event-stream"
      }
    }
  );
}
