import {
  NextRequest, NextResponse
} from "next/server";
import {
  prisma
} from "@/lib/connections/prisma";
import {
  Job
} from "bullmq";
import {
  RecordingQueueService
} from "@/lib/services/RecordingQueueService";
import {
  getJobById
} from "@/lib/jobStore";

type CancelRequest = {
  ids: string[];
};

export async function POST( req: NextRequest ) {
  try {
    const {
      ids
    }: CancelRequest = await req.json();

    if ( !ids || !Array.isArray( ids ) || ids.length === 0 ) {
      return new NextResponse(
        "Invalid job ids",
        {
          status: 400
        }
      );
    }

    const cancelled = [
    ];

    for ( const jobId of ids ) {
      const dbJob = await getJobById( jobId );

      if ( !dbJob ) continue;

      if ( [
        "completed",
        "failed",
        "cancelled"
      ].includes( dbJob.status ) ) {
        console.warn( `Job ${ jobId } is already finalized and cannot be cancelled.` );
        continue;
      }

      const bullJob: Job | undefined = await RecordingQueueService
        .getInstance()
        .getQueue()
        .getJob( jobId );

      if ( bullJob ) {
        const state = await bullJob.getState();

        if ( [
          "waiting",
          "delayed"
        ].includes( state ) ) {
          await bullJob.remove();

          await prisma.job.update( {
            where: {
              id: jobId
            },
            data: {
              status: "cancelled"
            },
          } );

          cancelled.push( jobId );
        } else if ( state === "active" ) {
          console.warn( `Job ${ jobId } is currently active and cannot be removed.` );
        }
      }
    }

    return NextResponse.json( {
      cancelled
    } );
  } catch ( error ) {
    console.error(
      "[POST /api/recordings/cancel] error:",
      error
    );
    return new NextResponse(
      "Internal Server Error",
      {
        status: 500
      }
    );
  }
}
