import {
  NextRequest
} from "next/server";
import {
  getProgress, hasJob, jobs
} from "@/lib/progressStore";

export async function GET( req: NextRequest ) {
  const id = req.nextUrl.searchParams.get( "id" );

  console.log(
    "GET",
    id,
    jobs
  );

  if ( !id || !hasJob( id ) ) {
    return new Response(
      "unknown jobId",
      {
        status: 404
      }
    );
  }

  let intervalId: NodeJS.Timeout | undefined = undefined;

  const stream = new ReadableStream( {
    start( controller ) {
      const sendUpdate = () => {
        const progress = getProgress( id );

        if ( !progress ) {
          if ( intervalId ) {
            clearInterval( intervalId );
          }

          controller.close();
          return;
        }

        controller.enqueue( `data: ${ JSON.stringify( progress ) }\n\n` );

        if ( progress.step === "done" || progress.step === "error" ) {
          if ( intervalId ) {
            clearInterval( intervalId );
          }

          controller.close();
        }
      };

      intervalId = setInterval(
        sendUpdate,
        500
      );

      sendUpdate();
    },
    cancel() {
      if ( intervalId ) {
        clearInterval( intervalId );
      }
    }
  } );

  return new Response(
    stream,
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }
  );
}