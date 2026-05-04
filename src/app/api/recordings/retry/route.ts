import {
  NextRequest, NextResponse
} from "next/server";

import {
  RecordingQueueService
} from "@/services/RecordingQueueService";
import {
  getJobById, updateJob
} from "@/lib/jobStore";
import {
  addRecordingStatus
} from "@/lib/progression";

export async function POST( req: NextRequest ) {
  try {
    const {
      ids
    }: {
      ids: string[];
    } = await req.json();

    if ( !Array.isArray( ids ) || ids.length === 0 ) {
      return new NextResponse(
        "Missing or invalid job IDs",
        {
          status: 400
        }
      );
    }

    const retried: string[] = [];

    for ( const jobId of ids ) {
      const existing = await getJobById( jobId );

      if ( !existing ) {
        continue;
      }

      // Reflect queued state in DB & SSE before worker picks it up
      await updateJob(
        jobId,
        {
          status: "queued",
          progress: 0
        }
      );
      await addRecordingStatus(
        jobId,
        "queued"
      );

      await RecordingQueueService.getInstance().getQueue()
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
  } catch( err ) {
    console.error(
      "[POST /api/recordings/retry] error:",
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
