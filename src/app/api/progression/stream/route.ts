import {
  getRecordingStatusAndTotalPercentage
} from "@/lib/progression";
import {
  NextRequest
} from "next/server";
import {
  JobId
} from "@/types/recording.types";

export async function GET( req: NextRequest ) {
  const idsParam = req.nextUrl.searchParams.get( "ids" );

  if ( !idsParam ) {
    return new Response(
      "Missing job IDs",
      {
        status: 400
      }
    );
  }

  const jobIds = idsParam.split( "," ).filter( Boolean ) as JobId[];

  if ( jobIds.length === 0 ) {
    return new Response(
      "No valid job IDs provided",
      {
        status: 400
      }
    );
  }

  let intervalId: NodeJS.Timeout | undefined = undefined;
  // A poll can take longer than the 500ms tick (the status query hits the DB),
  // so guard against the client disconnecting mid-poll — enqueuing on the
  // closed controller would otherwise throw an unhandled ERR_INVALID_STATE.
  let closed = false;
  // Don't let slow polls overlap and pile up; skip a tick while one is running.
  let polling = false;

  const stop = () => {
    closed = true;

    if ( intervalId ) {
      clearInterval( intervalId );
      intervalId = undefined;
    }
  };

  const stream = new ReadableStream( {
    async start( controller ) {
      controller.enqueue( "retry: 500\n\n" );

      // Stop as soon as the request is aborted (tab closed, navigation…).
      req.signal.addEventListener(
        "abort",
        stop
      );

      intervalId = setInterval(
        async() => {
          if ( closed || polling ) {
            return;
          }

          polling = true;

          try {
            for ( const id of jobIds ) {
              const update = await getRecordingStatusAndTotalPercentage( id );

              // The client may have disconnected during the await above.
              if ( closed || !update ) {
                continue;
              }

              controller.enqueue( `data: ${ JSON.stringify( {
                jobId: id,
                percentage: update.percentage,
                status: update.status,
                recordingDuration: update.recordingDuration,
                steps: update.steps,
                currentSlideIndex: update.currentSlideIndex
              } ) }\n\n` );
            }
          } catch {
            // Controller closed between the guard and the enqueue, or the
            // status query failed — stop polling either way.
            stop();
          } finally {
            polling = false;
          }
        },
        500
      );
    },
    cancel() {
      stop();
    }
  } );

  return new Response(
    stream,
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    }
  );
}
