import {
  getRecordingStatus, getRecordingStatusAndTotalPercentage
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
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: JobId
    }>
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

  const stream = new ReadableStream( {
    async start( controller ) {
      controller.enqueue( "retry: 250\n\n" );

      const sendUpdate = async() => {
        const jobCurrentStepAndPercentage = await getRecordingStatusAndTotalPercentage( id );

        if ( !jobCurrentStepAndPercentage ) {
          if ( intervalId ) {
            clearInterval( intervalId );
          }

          controller.close();
          return;
        }

        if ( jobCurrentStepAndPercentage.percentage === 100 || [
          "complete",
          "failed",
          "error"
        ].includes( jobCurrentStepAndPercentage.status ) ) {
          controller.enqueue( `data: ${ JSON.stringify( jobCurrentStepAndPercentage ) }\n\n` );

          if ( intervalId ) {
            clearInterval( intervalId );
          }

          controller.close();
          return;
        }

        controller.enqueue( `data: ${ JSON.stringify( jobCurrentStepAndPercentage ) }\n\n` );
      };

      intervalId = setInterval(
        async() => {
          await sendUpdate();
        },
        250
      );

      await sendUpdate();
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