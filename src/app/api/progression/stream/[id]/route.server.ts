import {
  getRecordingStatus,
  getRecordingStatusAndTotalPercentage
} from "@/lib/progression";

import {
  NextResponse, NextRequest
} from "next/server";
import {
  JobId
} from "@/types/recording.types";

/**
 * GET /api/progression/stream/[id]
 */
export async function GET(
  req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: JobId;
    }>;
  }
) {
  const id = ( await params ).id;
  const recordingStatus = await getRecordingStatus( id );

  if ( !recordingStatus ) {
    return new NextResponse(
      `recordingStatus not found for job ${ id }`,
      {
        status: 404
      }
    );
  }

  let intervalId: NodeJS.Timeout | undefined = undefined;
  // The status query (DB) can outlast the 250ms tick, so the client may
  // disconnect mid-poll; enqueuing/closing the controller afterwards would
  // throw an unhandled ERR_INVALID_STATE. Guard with a closed flag, prevent
  // overlapping polls, and make stop() idempotent.
  let closed = false;
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
      controller.enqueue( "retry: 250\n\n" );

      req.signal.addEventListener(
        "abort",
        stop
      );

      const finish = () => {
        stop();

        try {
          controller.close();
        } catch {
          // Already closed by the client — nothing to do.
        }
      };

      const sendUpdate = async() => {
        if ( closed || polling ) {
          return;
        }

        polling = true;

        try {
          const jobCurrentStepAndPercentage =
            await getRecordingStatusAndTotalPercentage( id );

          if ( closed ) {
            return;
          }

          if ( !jobCurrentStepAndPercentage ) {
            finish();
            return;
          }

          controller.enqueue( `data: ${ JSON.stringify( jobCurrentStepAndPercentage ) }\n\n` );

          if (
            jobCurrentStepAndPercentage.percentage === 100 ||
            [
              "completed",
              "failed",
              "cancelled"
            ].includes( jobCurrentStepAndPercentage.status )
          ) {
            finish();
          }
        } catch {
          // Controller closed mid-poll or the query failed — stop streaming.
          finish();
        } finally {
          polling = false;
        }
      };

      intervalId = setInterval(
        sendUpdate,
        250
      );

      await sendUpdate();
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
