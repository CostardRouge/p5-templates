import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById, deleteJob
} from "@/lib/jobStore";
import {
  RecordingQueueService
} from "@/services/RecordingQueueService";
import {
  deleteArtifact
} from "@/lib/connections/s3";

/**
 * GET /api/recordings/[id]
 *   → return the Job record from database
 */
export async function GET(
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
    const job = await getJobById( jobId );

    if ( !job ) {
      return new NextResponse(
        "Job not found",
        {
          status: 404
        }
      );
    }

    return NextResponse.json( job );
  } catch ( error ) {
    console.error(
      `[GET /api/recordings/${ jobId }]`,
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

/**
 * DELETE /api/recordings/[id]
 *   → delete a finalized job and its artifacts
 */
export async function DELETE(
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

    if ( ![
      "failed",
      "draft",
      "completed",
      "cancelled",
    ].includes( dbJob.status ) ) {
      return new NextResponse(
        "Job is not finalized and cannot be deleted",
        {
          status: 400
        }
      );
    }

    try {
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
        }
      }
    }
    catch ( _err ) {
      // ignore queue errors on delete
    }

    await deleteJob( jobId );
    await deleteArtifact( jobId );

    return NextResponse.json( {
      deleted: true
    } );
  } catch ( error ) {
    console.error(
      `[DELETE /api/recordings/${ jobId }]`,
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