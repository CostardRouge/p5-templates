import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById, updateJob
} from "@/lib/jobStore";
import {
  RecordingQueueService
} from "@/services/RecordingQueueService";

/**
 * POST /api/recordings/[id]/force-cancel
 * Force cancel a stale job that's stuck in active/queued state
 * This bypasses normal cancellation checks and forces the job to cancelled status
 */
export async function POST(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const jobId = ( await params ).id;

  try {
    const dbJob = await getJobById( jobId );

    if ( !dbJob ) {
      return new NextResponse(
        "Job not found",
        {
          status: 404
        }
      );
    }

    // Only allow force cancel for active/queued jobs
    if ( ![
      "active",
      "queued"
    ].includes( dbJob.status ) ) {
      return NextResponse.json( {
        cancelled: false,
        reason: "Job is not in active or queued state"
      } );
    }

    // Check if job is actually stale (more than 1 hour old)
    const hoursSinceUpdate =
      ( Date.now() - new Date( dbJob.updatedAt ).getTime() ) / ( 1000 * 60 * 60 );

    if ( hoursSinceUpdate < 1 ) {
      return NextResponse.json( {
        cancelled: false,
        reason: "Job is not stale (less than 1 hour old)"
      } );
    }

    // Try to remove from queue if it exists
    try {
      const bullJob = await RecordingQueueService.getInstance()
        .getQueue()
        .getJob( jobId );

      if ( bullJob ) {
        try {
          await bullJob.remove();
        } catch( err ) {
          console.warn(
            `Could not remove job ${ jobId } from queue:`,
            err
          );
          // Continue anyway - we'll mark it cancelled in DB
        }
      }
    } catch( err ) {
      console.warn(
        `Error accessing queue for job ${ jobId }:`,
        err
      );
      // Continue anyway - we'll mark it cancelled in DB
    }

    // Force update to cancelled status
    await updateJob(
      jobId,
      {
        status: "cancelled",
        progress: 100
      }
    );

    return NextResponse.json( {
      cancelled: true
    } );
  } catch( error ) {
    console.error(
      `[POST /api/recordings/${ jobId }/force-cancel]`,
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
