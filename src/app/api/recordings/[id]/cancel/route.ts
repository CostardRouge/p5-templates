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
    params
  }: {
    params: Promise<{
 id: string
}>
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

    if ( [
      "completed",
      "failed",
      "cancelled"
    ].includes( dbJob.status ) ) {
      return NextResponse.json( {
        cancelled: false,
        reason: "already finalized"
      } );
    }

    const bullJob = await RecordingQueueService
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
      }

      if ( state === "active" ) {
        return NextResponse.json( {
          cancelled: false,
          reason: "job is active"
        } );
      }
    }

    // No bull job: if it's draft or other pre-flight, don't mark cancelled, suggest delete
    return NextResponse.json( {
      cancelled: false,
      reason: "not cancellable in current state"
    } );
  } catch ( error ) {
    console.error(
      `[POST /api/recordings/${ jobId }/cancel]`,
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
