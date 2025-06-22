import {
  NextRequest, NextResponse
} from "next/server";

import {
  RecordingQueueService
} from "@/lib/services/RecordingQueueService";
import {
  getJobById
} from "@/lib/jobStore";

export async function POST( req: NextRequest ) {
  try {
    const {
      ids
    }: {
 ids: string[]
} = await req.json();

    if ( !Array.isArray( ids ) || ids.length === 0 ) {
      return new NextResponse(
        "Missing or invalid job IDs",
        {
          status: 400
        }
      );
    }

    const retried: string[] = [
    ];

    for ( const jobId of ids ) {
      const existing = await getJobById( jobId );

      if ( !existing ) {
        continue;
      }

      await RecordingQueueService
        .getInstance()
        .getQueue()
        .add(
          "process-recording",
          {
            jobId: existing.id,
            template: existing.template
          },
          {
            jobId,
            priority: 1,
            delay: 0,
            removeOnFail: true,
            removeOnComplete: true
          }
        );

      retried.push( jobId );
    }

    return NextResponse.json( {
      retried
    } );
  } catch ( err ) {
    console.error(
      "[POST /api/jobs/retry] error:",
      err
    );
    return new NextResponse(
      "Internal Server Error",
      {
        status: 500
      }
    );
  }
}
