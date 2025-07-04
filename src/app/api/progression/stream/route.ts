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

  const stream = new ReadableStream( {
    async start( controller ) {
      controller.enqueue( "retry: 500\n\n" );

      intervalId = setInterval(
        async() => {
          for ( const id of jobIds ) {
            const update = await getRecordingStatusAndTotalPercentage( id );

            if ( update ) {
              controller.enqueue( `data: ${ JSON.stringify( {
                jobId: id,
                percentage: update.percentage,
                status: update.status
              } ) }\n\n` );
            }
          }
        },
        500
      );
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
      }
    }
  );
}
