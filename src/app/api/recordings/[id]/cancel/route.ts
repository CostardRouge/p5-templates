import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById, updateJob
} from "@/lib/jobStore";
import {
  RecordingQueueService
} from "@/services/RecordingQueueService";

export async function POST(
  _req: NextRequest,
  {
    params,
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
          status: 404,
        }
      );
    }

    if ( [
      "completed",
      "failed",
      "cancelled"
    ].includes( dbJob.status ) ) {
      return NextResponse.json( {
        cancelled: false,
        reason: "already finalized",
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
        } catch ( err ) {
          console.warn(
            `Could not remove job ${ jobId } from queue:`,
            err
          );
          // Continue anyway - we'll mark it cancelled in DB
        }
      }
    } catch ( err ) {
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
        progress: 100,
      }
    );

    return NextResponse.json( {
      cancelled: true,
    } );
  } catch ( error ) {
    console.error(
      `[POST /api/recordings/${ jobId }/cancel]`,
      error
    );
    return new NextResponse(
      "Internal Server Error",
      {
        status: 500,
      }
    );
  }
}
